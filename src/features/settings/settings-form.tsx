"use client";

import { useMemo, useRef, useState } from "react";
import { renderVeoTemplate, validateVeoTemplate, type VeoVariables } from "./veo-template";
import { renderGeminiTemplate, validateGeminiTemplate, type GeminiVariables } from "./gemini-template";
import { LibrarySettings } from "@/features/library/library-settings";

export type PublicSettingsView = {
  apiKeyConfigured: boolean;
  apiKeyMask: string | null;
  model: string;
  veoTemplate: string;
  geminiTemplate: string;
  updatedAt: string;
};

type SettingsUpdate = { apiKey?: string; model: string; veoTemplate: string; geminiTemplate: string };
type Tab = "credential" | "model" | "template" | "gemini" | "library";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "credential", label: "Credencial" },
  { id: "model", label: "Modelo" },
  { id: "template", label: "Prompt VEO 3" },
  { id: "gemini", label: "Prompt Gemini" },
  { id: "library", label: "Biblioteca" },
];

const previewValues: VeoVariables = {
  produto: "Garrafa térmica Aurora",
  copy_trecho: "Eu levo água gelada comigo o dia todo,",
  pov: "POV: hidratação sem esforço 💧",
  ambiente: "cozinha iluminada",
  figurino: "camiseta branca casual",
  pose: "segurando a garrafa perto da câmera",
  prompt_gemini: "Vídeo UGC vertical, luz natural e demonstração do produto.",
  speech_beats: '- On "gelada": quick push-in + gesture beside the bottle → bottle remains visible',
};

const geminiPreviewValues: GeminiVariables = {
  identidade_ugc: "Preserve exatamente a pessoa das imagens de referência.",
  produto: "Garrafa térmica Aurora",
  wardrobe_lock: "Roupa casual neutra sem estampas.",
  tecido: "Malha lisa com caimento natural.",
  evitar: "Não adicionar logotipos ou acessórios.",
  calcado: "Tênis neutro, não usar salto.",
  cenario: "cozinha iluminada",
  iluminacao: "luz natural lateral",
  acao: "mostrar a garrafa sem cobrir o produto",
  pose: "em pé, postura relaxada",
  enquadramento_extra: "",
};

async function defaultSave(input: SettingsUpdate): Promise<PublicSettingsView> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Não foi possível salvar as configurações");
  return response.json();
}

async function defaultDeleteKey() {
  const response = await fetch("/api/settings/api-key", { method: "DELETE" });
  if (!response.ok) throw new Error("Não foi possível remover a credencial");
}

export function SettingsForm({ initial, onSave = defaultSave, onDeleteKey = defaultDeleteKey }: {
  initial: PublicSettingsView;
  onSave?: (input: SettingsUpdate) => Promise<PublicSettingsView | void> | PublicSettingsView | void;
  onDeleteKey?: () => Promise<PublicSettingsView | void> | PublicSettingsView | void;
}) {
  const [settings, setSettings] = useState(initial);
  const [activeTab, setActiveTab] = useState<Tab>("credential");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [veoTemplate, setVeoTemplate] = useState(initial.veoTemplate);
  const [geminiTemplate, setGeminiTemplate] = useState(initial.geminiTemplate);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const templateValidation = useMemo(() => validateVeoTemplate(veoTemplate), [veoTemplate]);
  const geminiTemplateValidation = useMemo(() => validateGeminiTemplate(geminiTemplate), [geminiTemplate]);
  const preview = useMemo(() => {
    if (!templateValidation.valid) return veoTemplate;
    try {
      return renderVeoTemplate(veoTemplate, previewValues);
    } catch {
      return veoTemplate;
    }
  }, [templateValidation, veoTemplate]);
  const geminiPreview = useMemo(() => {
    if (!geminiTemplateValidation.valid) return geminiTemplate;
    try {
      return renderGeminiTemplate(geminiTemplate, geminiPreviewValues);
    } catch {
      return geminiTemplate;
    }
  }, [geminiTemplate, geminiTemplateValidation]);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    setStatus(null);
  }

  function moveTab(currentIndex: number, direction: 1 | -1) {
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex].id);
    tabsRef.current[nextIndex]?.focus();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateValidation.valid) {
      setActiveTab("template");
      setStatus("Corrija as variáveis não permitidas do template antes de salvar.");
      return;
    }
    if (!geminiTemplateValidation.valid) {
      setActiveTab("gemini");
      setStatus("Corrija as variáveis não permitidas do template Gemini antes de salvar.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const saved = await onSave({ model: model.trim(), veoTemplate: veoTemplate.trim(), geminiTemplate: geminiTemplate.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
      if (saved) {
        setSettings(saved);
        setModel(saved.model);
        setVeoTemplate(saved.veoTemplate);
        setGeminiTemplate(saved.geminiTemplate);
      } else {
        setSettings((current) => ({ ...current, model: model.trim(), veoTemplate: veoTemplate.trim(), geminiTemplate: geminiTemplate.trim() }));
      }
      setApiKey("");
      setStatus("Configurações salvas.");
    } catch {
      setStatus("Não foi possível salvar as configurações. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteKey() {
    setIsSaving(true);
    setStatus(null);
    try {
      const deleted = await onDeleteKey();
      setSettings(deleted ?? ((current) => ({ ...current, apiKeyConfigured: false, apiKeyMask: null })));
      setApiKey("");
      setStatus("Credencial removida.");
    } catch {
      setStatus("Não foi possível remover a credencial. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 rounded-3xl border border-[#e6ded6] bg-white p-5 shadow-[0_1.5rem_4rem_rgb(32_26_34_/_8%)] sm:p-8" noValidate>
      <div role="tablist" aria-label="Seções de configurações" className="flex flex-wrap gap-2 border-b border-[#e6ded6] pb-4">
        {tabs.map((tab, index) => (
          <button key={tab.id} ref={(node) => { tabsRef.current[index] = node; }} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-[#6f52d9] text-white" : "bg-[#f7f3ee] text-[#514955] hover:bg-[#fff6f3]"}`} type="button" role="tab" id={`settings-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`settings-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); moveTab(index, 1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(index, -1); }
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id="settings-panel-credential" aria-labelledby="settings-tab-credential" hidden={activeTab !== "credential"} className="grid gap-4 py-6 text-[#514955]">
        <h2>Credencial Anthropic</h2>
        <p>{settings.apiKeyConfigured ? "Chave configurada:" : "Nenhuma chave configurada."} {settings.apiKeyMask && <strong>{settings.apiKeyMask}</strong>}</p>
        <label htmlFor="api-key">Nova chave da Anthropic</label>
        <input id="api-key" name="apiKey" className="w-full rounded-lg border border-[#cfc5bd] px-3 py-2" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder="Substitua a chave, se necessário" />
        <p className="text-sm text-[#665e68]">Deixe em branco para manter a chave salva. A chave atual nunca é exibida.</p>
        {settings.apiKeyConfigured && <button type="button" className="w-fit rounded-lg px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff1f0]" disabled={isSaving} onClick={deleteKey}>Remover credencial</button>}
      </section>

      <section role="tabpanel" id="settings-panel-model" aria-labelledby="settings-tab-model" hidden={activeTab !== "model"} className="grid gap-4 py-6 text-[#514955]">
        <h2>Modelo</h2>
        <label htmlFor="model">Modelo Anthropic</label>
        <input id="model" name="model" className="w-full rounded-lg border border-[#cfc5bd] px-3 py-2" value={model} onChange={(event) => setModel(event.target.value)} required />
      </section>

      <section role="tabpanel" id="settings-panel-template" aria-labelledby="settings-tab-template" hidden={activeTab !== "template"} className="grid gap-4 py-6 text-[#514955]">
        <h2>Prompt VEO 3</h2>
        <label htmlFor="veo-template">Template VEO 3</label>
        <textarea id="veo-template" name="veoTemplate" className="w-full rounded-lg border border-[#cfc5bd] px-3 py-2 font-mono text-sm" rows={8} value={veoTemplate} onChange={(event) => setVeoTemplate(event.target.value)} aria-invalid={!templateValidation.valid} aria-describedby={`veo-template-help${templateValidation.valid ? "" : " veo-template-error"}`} required />
        <p id="veo-template-help" className="text-sm text-[#665e68]">Variáveis aceitas: {"{{produto}}"}, {"{{copy_trecho}}"}, {"{{pov}}"}, {"{{ambiente}}"}, {"{{figurino}}"}, {"{{pose}}"}, {"{{prompt_gemini}}"} e {"{{speech_beats}}"}. Um prompt VEO completo é renderizado para cada trecho de fala do criativo.</p>
        {!templateValidation.valid && <p id="veo-template-error" role="alert" className="rounded-lg bg-[#fff1f0] p-3 text-sm text-[#b42318]">Variáveis não permitidas: {templateValidation.unknown.join(", ")}.</p>}
        <h3>Prévia com dados fictícios</h3>
        <output className="whitespace-pre-wrap rounded-xl bg-[#fff6f3] p-4 text-sm leading-6 text-[#201a22]">{preview}</output>
      </section>

      <section role="tabpanel" id="settings-panel-gemini" aria-labelledby="settings-tab-gemini" hidden={activeTab !== "gemini"} className="grid gap-4 py-6 text-[#514955]">
        <h2>Prompt Gemini</h2>
        <label htmlFor="gemini-template">Template Gemini</label>
        <textarea id="gemini-template" name="geminiTemplate" className="w-full rounded-lg border border-[#cfc5bd] px-3 py-2 font-mono text-sm" rows={12} value={geminiTemplate} onChange={(event) => setGeminiTemplate(event.target.value)} aria-invalid={!geminiTemplateValidation.valid} aria-describedby={`gemini-template-help${geminiTemplateValidation.valid ? "" : " gemini-template-error"}`} required />
        <p id="gemini-template-help" className="text-sm text-[#665e68]">Variáveis aceitas: {"{{identidade_ugc}}"}, {"{{produto}}"}, {"{{wardrobe_lock}}"}, {"{{tecido}}"}, {"{{evitar}}"}, {"{{calcado}}"}, {"{{cenario}}"}, {"{{iluminacao}}"}, {"{{acao}}"}, {"{{pose}}"} e {"{{enquadramento_extra}}"}.</p>
        {!geminiTemplateValidation.valid && <p id="gemini-template-error" role="alert" className="rounded-lg bg-[#fff1f0] p-3 text-sm text-[#b42318]">Variáveis não permitidas: {geminiTemplateValidation.unknown.join(", ")}.</p>}
        <h3>Prévia com dados fictícios</h3>
        <output className="whitespace-pre-wrap rounded-xl bg-[#fff6f3] p-4 text-sm leading-6 text-[#201a22]">{geminiPreview}</output>
      </section>

      <section role="tabpanel" id="settings-panel-library" aria-labelledby="settings-tab-library" hidden={activeTab !== "library"} className="grid gap-4 py-6 text-[#514955]">
        <LibrarySettings />
      </section>

      {status && <p role="status" className="mt-2 rounded-lg bg-[#f1edff] p-3 text-sm text-[#443181]">{status}</p>}
      <button type="submit" disabled={isSaving} className="mt-6 rounded-lg bg-[#ef6a5b] px-4 py-3 font-semibold text-white hover:bg-[#d95649] disabled:opacity-60">{isSaving ? "Salvando…" : "Salvar configurações"}</button>
    </form>
  );
}
