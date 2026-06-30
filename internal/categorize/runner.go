package categorize

import (
	"context"
	"sync"

	"github.com/sh-yazdipour/vibe-badget/internal/store"
)

type Classifier interface {
	Classify(ctx context.Context, partner string, categories []string) (string, error)
}

type Result struct {
	Rules   int `json:"rules"`
	LLM     int `json:"llm"`
	Skipped int `json:"skipped"`
}

// Run applies rules to every uncategorized transaction, then sends whatever
// is left to the LLM through a bounded worker pool of size `concurrency`.
func Run(ctx context.Context, s *store.Store, llm Classifier, concurrency int) (Result, error) {
	var res Result

	rules, err := s.ActiveRules()
	if err != nil {
		return res, err
	}
	byName, names, err := s.CategoryNames()
	if err != nil {
		return res, err
	}
	txns, err := s.UncategorizedTransactions()
	if err != nil {
		return res, err
	}

	// Pass 1: rules (cheap, sequential).
	var forLLM []int64
	partnerOf := map[int64]string{}
	for _, t := range txns {
		if catID, ok := Match(t, rules); ok {
			if err := s.SetCategory(t.ID, catID, "rule"); err != nil {
				return res, err
			}
			res.Rules++
			continue
		}
		forLLM = append(forLLM, t.ID)
		partnerOf[t.ID] = t.PartnerName
	}

	if llm == nil || concurrency < 1 {
		res.Skipped = len(forLLM)
		return res, nil
	}

	// Pass 2: LLM in parallel.
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	for _, id := range forLLM {
		wg.Add(1)
		sem <- struct{}{}
		go func(txID int64) {
			defer wg.Done()
			defer func() { <-sem }()

			name, cerr := llm.Classify(ctx, partnerOf[txID], names)
			mu.Lock()
			defer mu.Unlock()
			if cerr != nil || name == "Uncategorized" {
				res.Skipped++
				return
			}
			if catID, ok := byName[name]; ok {
				if err := s.SetCategory(txID, catID, "llm"); err == nil {
					res.LLM++
				}
			} else {
				res.Skipped++
			}
		}(id)
	}
	wg.Wait()
	return res, nil
}
