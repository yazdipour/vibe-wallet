package categorize

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

// Classify asks the LLM to pick exactly one category for a transaction
// partner, then snaps the answer to a known category name.
func (l *LLM) Classify(ctx context.Context, partner string, categories []string) (string, error) {
	prompt := fmt.Sprintf(
		"You categorise bank transactions. Choose exactly ONE category from this list "+
			"that best matches the merchant/partner. Reply with only the category name, nothing else.\n"+
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
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if l.cfg.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+l.cfg.APIKey)
	}

	resp, err := l.hc.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("llm http %d", resp.StatusCode)
	}

	var cr chatResp
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return "", err
	}
	if len(cr.Choices) == 0 {
		return "Uncategorized", nil
	}
	answer := strings.Trim(strings.TrimSpace(cr.Choices[0].Message.Content), `"'.`)
	for _, c := range categories {
		if strings.EqualFold(answer, c) {
			return c, nil
		}
	}
	return "Uncategorized", nil
}
