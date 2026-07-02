package categorize

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type LLMConfig struct {
	BaseURL string
	APIKey  string
	Model   string
}

type LLM struct {
	cfg LLMConfig
	hc  *http.Client
}

func NewLLM(cfg LLMConfig) *LLM {
	return &LLM{cfg: cfg, hc: &http.Client{Timeout: 60 * time.Second}}
}

type chatReq struct {
	Model    string    `json:"model"`
	Messages []chatMsg `json:"messages"`
	Stream   bool      `json:"stream"`
}
type chatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type chatResp struct {
	Choices []struct {
		Message chatMsg `json:"message"`
	} `json:"choices"`
}

type classifyResponse struct {
	Category string `json:"category"`
	Reason   string `json:"reason"`
}

// Classify asks the LLM to pick exactly one category for a transaction
// partner and explain why, then snaps the answer to a known category name.
func (l *LLM) Classify(ctx context.Context, partner string, categories []string) (string, string, error) {
	start := time.Now()
	log.Printf("llm: classifying partner %q", partner)
	prompt := fmt.Sprintf(
		"You categorise bank transactions. Choose exactly ONE category from this list "+
			"that best matches the merchant/partner, and give a one-sentence reason. "+
			"Reply with ONLY a JSON object of the form {\"category\":\"<name>\",\"reason\":\"<reason>\"}, nothing else.\n"+
			"Categories: %s\nPartner: %s",
		strings.Join(categories, ", "), partner)

	body, _ := json.Marshal(chatReq{
		Model:    l.cfg.Model,
		Stream:   false,
		Messages: []chatMsg{{Role: "user", Content: prompt}},
	})

	url := strings.TrimRight(l.cfg.BaseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		log.Printf("llm: classify %q failed building request: %v", partner, err)
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if l.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+l.cfg.APIKey)
	}

	resp, err := l.hc.Do(req)
	if err != nil {
		log.Printf("llm: classify %q failed after %s: %v", partner, time.Since(start), err)
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("llm: classify %q got http %d after %s", partner, resp.StatusCode, time.Since(start))
		return "", "", fmt.Errorf("llm http %d", resp.StatusCode)
	}

	var cr chatResp
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		log.Printf("llm: classify %q failed decoding response after %s: %v", partner, time.Since(start), err)
		return "", "", err
	}
	if len(cr.Choices) == 0 {
		log.Printf("llm: classify %q got no choices after %s", partner, time.Since(start))
		return "Uncategorized", "", nil
	}

	answer, reason := parseClassifyContent(cr.Choices[0].Message.Content)
	for _, c := range categories {
		if strings.EqualFold(answer, c) {
			log.Printf("llm: classify %q -> %q in %s", partner, c, time.Since(start))
			return c, reason, nil
		}
	}
	log.Printf("llm: classify %q -> Uncategorized in %s", partner, time.Since(start))
	return "Uncategorized", reason, nil
}

// parseClassifyContent extracts the category and reason from the LLM's reply.
// It expects {"category":"...","reason":"..."}, optionally wrapped in a
// ```json ... ``` fence, but falls back to treating the raw trimmed content
// as a bare category name (with no reason) if the model didn't follow the
// JSON instruction.
func parseClassifyContent(content string) (category string, reason string) {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var cr classifyResponse
	if err := json.Unmarshal([]byte(trimmed), &cr); err == nil && cr.Category != "" {
		return cr.Category, cr.Reason
	}
	return strings.Trim(strings.TrimSpace(content), `"'.`), ""
}

type PingResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type modelsResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

// Ping checks whether the configured LLM server is reachable and whether the
// configured model is present in its model list.
func (l *LLM) Ping(ctx context.Context) PingResult {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	url := strings.TrimRight(l.cfg.BaseURL, "/") + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return PingResult{Status: "unreachable", Message: err.Error()}
	}
	if l.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+l.cfg.APIKey)
	}

	resp, err := l.hc.Do(req)
	if err != nil {
		return PingResult{Status: "unreachable", Message: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return PingResult{Status: "unreachable", Message: fmt.Sprintf("http %d", resp.StatusCode)}
	}

	var mr modelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&mr); err != nil {
		return PingResult{Status: "unreachable", Message: err.Error()}
	}

	for _, m := range mr.Data {
		if m.ID == l.cfg.Model {
			return PingResult{Status: "ok", Message: fmt.Sprintf("%d models available", len(mr.Data))}
		}
	}
	return PingResult{
		Status:  "model_not_found",
		Message: fmt.Sprintf("model not in server's list (%d available)", len(mr.Data)),
	}
}

type PartnerCategory struct {
	Partner  string
	Category string
}

type RuleSuggestion struct {
	Pattern   string `json:"pattern"`
	MatchType string `json:"match_type"`
	Category  string `json:"category"`
	Reason    string `json:"reason"`
}

// SuggestRules asks the LLM to propose new categorization rules for
// partners that have been categorized by the LLM but aren't yet covered by
// any existing rule.
func (l *LLM) SuggestRules(ctx context.Context, partners []PartnerCategory, existingPatterns []string, categories []string) ([]RuleSuggestion, error) {
	if len(partners) == 0 {
		return nil, nil
	}
	start := time.Now()
	log.Printf("llm: suggesting rules for %d partner(s)", len(partners))

	var pcLines []string
	for _, p := range partners {
		pcLines = append(pcLines, fmt.Sprintf("%s -> %s", p.Partner, p.Category))
	}

	prompt := fmt.Sprintf(
		"You help build categorization rules for bank transactions. Below is a list of merchant "+
			"partners and the category an automatic classifier most recently assigned them. Existing "+
			"rules already cover these patterns, do not repeat them: %s\n\n"+
			"Partners and their categories:\n%s\n\n"+
			"Categories available: %s\n\n"+
			"Suggest additional rules to automatically categorize future transactions from these "+
			"merchants. For each rule, choose \"exact\" match_type if the partner name is always "+
			"identical, or \"keyword\" if only part of the name is stable (e.g. a merchant ID varies). "+
			"Reply with ONLY a JSON array of objects of the form "+
			"{\"pattern\":\"<text>\",\"match_type\":\"exact\"|\"keyword\",\"category\":\"<name>\",\"reason\":\"<reason>\"}, nothing else.",
		strings.Join(existingPatterns, ", "), strings.Join(pcLines, "\n"), strings.Join(categories, ", "))

	body, _ := json.Marshal(chatReq{
		Model:    l.cfg.Model,
		Stream:   false,
		Messages: []chatMsg{{Role: "user", Content: prompt}},
	})

	url := strings.TrimRight(l.cfg.BaseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		log.Printf("llm: suggest rules failed building request: %v", err)
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if l.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+l.cfg.APIKey)
	}

	resp, err := l.hc.Do(req)
	if err != nil {
		log.Printf("llm: suggest rules failed after %s: %v", time.Since(start), err)
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("llm: suggest rules got http %d after %s", resp.StatusCode, time.Since(start))
		return nil, fmt.Errorf("llm http %d", resp.StatusCode)
	}

	var cr chatResp
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		log.Printf("llm: suggest rules failed decoding response after %s: %v", time.Since(start), err)
		return nil, err
	}
	if len(cr.Choices) == 0 {
		log.Printf("llm: suggest rules got no choices after %s", time.Since(start))
		return nil, nil
	}

	raw := parseSuggestionsContent(cr.Choices[0].Message.Content)

	catByLower := map[string]string{}
	for _, c := range categories {
		catByLower[strings.ToLower(c)] = c
	}

	var out []RuleSuggestion
	for _, r := range raw {
		canonical, ok := catByLower[strings.ToLower(r.Category)]
		if !ok {
			continue
		}
		matchType := r.MatchType
		if matchType != "exact" && matchType != "keyword" {
			matchType = "keyword"
		}
		out = append(out, RuleSuggestion{
			Pattern: r.Pattern, MatchType: matchType, Category: canonical, Reason: r.Reason,
		})
	}
	log.Printf("llm: suggest rules -> %d suggestion(s) in %s", len(out), time.Since(start))
	return out, nil
}

type ruleSuggestionResponse struct {
	Pattern   string `json:"pattern"`
	MatchType string `json:"match_type"`
	Category  string `json:"category"`
	Reason    string `json:"reason"`
}

// parseSuggestionsContent extracts a JSON array of rule suggestions from the
// LLM's reply, optionally wrapped in a ```json ... ``` fence (same tolerant
// parsing pattern as parseClassifyContent). Returns nil if the content
// isn't a valid JSON array — the caller treats that as "no suggestions"
// rather than an error, consistent with this package's fallback philosophy.
func parseSuggestionsContent(content string) []ruleSuggestionResponse {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var out []ruleSuggestionResponse
	if err := json.Unmarshal([]byte(trimmed), &out); err != nil {
		return nil
	}
	return out
}
