import { useEffect, useState } from "react";
import { api, type LLMHealth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

function healthVariant(status: string): "default" | "destructive" | "outline" {
  if (status === "ok") return "default";
  if (status === "unconfigured") return "outline";
  return "destructive";
}

export default function Settings() {
  const [s, setS] = useState<Record<string, string>>({
    llm_base_url: "http://host.docker.internal:11434/v1",
    llm_model: "llama3.1",
    llm_concurrency: "4",
    llm_api_key: "",
  });
  const [health, setHealth] = useState<LLMHealth | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { api.getSettings().then((v) => setS((p) => ({ ...p, ...v, llm_api_key: "" }))); }, []);

  async function checkHealth() {
    setChecking(true);
    try {
      const h = await api.llmHealth();
      setHealth(h);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => { checkHealth(); }, []);

  async function save() {
    try {
      await api.putSettings(s);
      toast.success("Saved");
      checkHealth();
    } catch (e) {
      toast.error(String(e));
    }
  }

  const field = (key: string, label: string, placeholder = "") => (
    <label className="block space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Input value={s[key] ?? ""} placeholder={placeholder}
        onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>LLM configuration (OpenAI-compatible / Ollama)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {field("llm_base_url", "Base URL", "http://host.docker.internal:11434/v1")}
          {field("llm_model", "Model", "llama3.1")}
          {field("llm_api_key", "API key (leave blank to keep current)")}
          {field("llm_concurrency", "Parallel workers")}
          <Button onClick={save}>Save</Button>

          <div className="flex items-center gap-2 border-t pt-4">
            {checking ? (
              <span className="text-sm text-muted-foreground">Checking…</span>
            ) : health ? (
              <>
                <Badge variant={healthVariant(health.status)}>{health.status}</Badge>
                <span className="text-sm text-muted-foreground">{health.message}</span>
              </>
            ) : null}
            <Button size="sm" variant="ghost" onClick={checkHealth} disabled={checking}>Recheck</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
