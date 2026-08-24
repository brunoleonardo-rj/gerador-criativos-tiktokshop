"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { assetStorage, draftStorage, type ImageRole, type StoredImage } from "@/features/draft/storage";
import type { Draft } from "@/features/draft/schema";
import { generationInputSchema, type GenerationInput } from "@/features/generation/schema";
import type { GenerationEnvelope } from "@/features/generation/validation";
import { getProductSourceImages, imageSelectionKey } from "@/features/product-extraction/image-selection";
import { productExtractionSchema, type ProductExtraction } from "@/features/product-extraction/schema";
import { DirectionStep } from "./direction-step";
import { ProductStep, type ProductStepState } from "./product-step";
import { ReferencesStep, type ReferenceError } from "./references-step";
import styles from "./wizard.module.css";

export type WizardFormValues = {
  nomeProduto: string;
  categoria: string;
  descricaoPdp: string;
  avaliacoes: string;
  notaMedia: string;
  quantidadeAvaliacoes: string;
  precoAtual: string;
  precoAnterior: string;
  especificacoesTexto: string;
  publicoAlvo: string;
  perfilUgc: string;
  linkProduto: string;
  quantidadeCriativos: string;
  ambientesTexto: string;
  politicaPreco: "sem_preco" | "teto_folgado" | "preco_exato_com_aviso";
  duracaoTotal: "15" | "20" | "30";
  povComEmoji: boolean;
  maxPalavrasPov: string;
  quantidadeHashtags: string;
  tomVoz: string;
};

export type ProductAnalysisDraft = {
  productAnalysisKey?: string;
  productExtractionWarnings?: string[];
};

const text = z.string().trim().min(1, "Campo obrigatório.");
const formSchema = z.object({
  nomeProduto: z.string().trim().min(1, "Informe o nome do produto"),
  categoria: z.string().trim().min(1, "Informe a categoria"),
  descricaoPdp: z.string().trim().min(1, "Informe a descrição do anúncio"),
  avaliacoes: z.string(),
  notaMedia: z.string(),
  quantidadeAvaliacoes: z.string(),
  precoAtual: z.string(),
  precoAnterior: z.string(),
  especificacoesTexto: z.string(),
  publicoAlvo: z.string(),
  perfilUgc: z.string().trim().min(1, "Informe o perfil UGC"),
  linkProduto: z.union([z.literal(""), z.string().url("Informe uma URL válida.")]),
  quantidadeCriativos: z.string(),
  ambientesTexto: text,
  politicaPreco: z.enum(["sem_preco", "teto_folgado", "preco_exato_com_aviso"]),
  duracaoTotal: z.enum(["15", "20", "30"]),
  povComEmoji: z.boolean(),
  maxPalavrasPov: z.string(),
  quantidadeHashtags: z.string(),
  tomVoz: text,
}).superRefine((values, context) => {
  const bounded = (
    field: "notaMedia" | "quantidadeAvaliacoes" | "quantidadeCriativos" | "maxPalavrasPov" | "quantidadeHashtags",
    min: number,
    max: number,
    message: string,
    optionalValue = false,
  ) => {
    const raw = values[field].trim();
    if (optionalValue && raw === "") return;
    const numericValue = Number(raw);
    if (!Number.isFinite(numericValue) || (!Number.isInteger(numericValue) && field !== "notaMedia") || numericValue < min || numericValue > max) {
      context.addIssue({ code: "custom", path: [field], message });
    }
  };
  bounded("notaMedia", 0, 5, "Informe uma nota entre 0 e 5.", true);
  bounded("quantidadeAvaliacoes", 0, 10_000_000, "Informe uma quantidade de avaliações válida.", true);
  bounded("quantidadeCriativos", 1, 8, "Escolha entre 1 e 8 criativos.");
  bounded("maxPalavrasPov", 1, 30, "Informe um limite de POV entre 1 e 30 palavras.");
  bounded("quantidadeHashtags", 1, 20, "Informe entre 1 e 20 hashtags.");
});

const defaultValues: WizardFormValues = {
  nomeProduto: "",
  categoria: "",
  descricaoPdp: "",
  avaliacoes: "",
  notaMedia: "",
  quantidadeAvaliacoes: "",
  precoAtual: "",
  precoAnterior: "",
  especificacoesTexto: "",
  publicoAlvo: "",
  perfilUgc: "",
  linkProduto: "",
  quantidadeCriativos: "5",
  ambientesTexto: "casa",
  politicaPreco: "sem_preco",
  duracaoTotal: "20",
  povComEmoji: true,
  maxPalavrasPov: "11",
  quantidadeHashtags: "5",
  tomVoz: "natural",
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numeric(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function toInput(values: WizardFormValues): GenerationInput {
  return generationInputSchema.parse({
    nomeProduto: values.nomeProduto,
    categoria: values.categoria,
    descricaoPdp: values.descricaoPdp,
    avaliacoes: optional(values.avaliacoes),
    notaMedia: numeric(values.notaMedia),
    quantidadeAvaliacoes: numeric(values.quantidadeAvaliacoes),
    precoAtual: optional(values.precoAtual),
    precoAnterior: optional(values.precoAnterior),
    especificacoesCriticas: values.especificacoesTexto.split("\n").map((item) => item.trim()).filter(Boolean),
    publicoAlvo: optional(values.publicoAlvo),
    perfilUgc: values.perfilUgc,
    linkProduto: optional(values.linkProduto),
    quantidadeCriativos: Number(values.quantidadeCriativos),
    ambientesPermitidos: values.ambientesTexto.split("\n").map((item) => item.trim()).filter(Boolean),
    politicaPreco: values.politicaPreco,
    duracaoTotal: Number(values.duracaoTotal),
    povComEmoji: values.povComEmoji,
    maxPalavrasPov: Number(values.maxPalavrasPov),
    quantidadeHashtags: Number(values.quantidadeHashtags),
    tomVoz: values.tomVoz,
  });
}

export function fromDraft(draft: Draft): WizardFormValues {
  const source = draft as Record<string, unknown>;
  return {
    ...defaultValues,
    nomeProduto: typeof source.nomeProduto === "string" ? source.nomeProduto : defaultValues.nomeProduto,
    categoria: typeof source.categoria === "string" ? source.categoria : defaultValues.categoria,
    descricaoPdp: typeof source.descricaoPdp === "string" ? source.descricaoPdp : defaultValues.descricaoPdp,
    avaliacoes: typeof source.avaliacoes === "string" ? source.avaliacoes : "",
    precoAtual: typeof source.precoAtual === "string" ? source.precoAtual : "",
    precoAnterior: typeof source.precoAnterior === "string" ? source.precoAnterior : "",
    publicoAlvo: typeof source.publicoAlvo === "string" ? source.publicoAlvo : "",
    perfilUgc: typeof source.perfilUgc === "string" ? source.perfilUgc : "",
    linkProduto: typeof source.linkProduto === "string" ? source.linkProduto : "",
    politicaPreco: source.politicaPreco === "teto_folgado" || source.politicaPreco === "preco_exato_com_aviso" ? source.politicaPreco : "sem_preco",
    povComEmoji: typeof source.povComEmoji === "boolean" ? source.povComEmoji : true,
    tomVoz: typeof source.tomVoz === "string" ? source.tomVoz : defaultValues.tomVoz,
    notaMedia: typeof source.notaMedia === "number" ? source.notaMedia.toString() : "",
    quantidadeAvaliacoes: typeof source.quantidadeAvaliacoes === "number" ? source.quantidadeAvaliacoes.toString() : "",
    quantidadeCriativos: typeof source.quantidadeCriativos === "number" ? source.quantidadeCriativos.toString() : defaultValues.quantidadeCriativos,
    maxPalavrasPov: typeof source.maxPalavrasPov === "number" ? source.maxPalavrasPov.toString() : defaultValues.maxPalavrasPov,
    quantidadeHashtags: typeof source.quantidadeHashtags === "number" ? source.quantidadeHashtags.toString() : defaultValues.quantidadeHashtags,
    duracaoTotal: source.duracaoTotal === 15 || source.duracaoTotal === 30 ? source.duracaoTotal.toString() as "15" | "30" : "20",
    especificacoesTexto: Array.isArray(source.especificacoesCriticas) ? source.especificacoesCriticas.filter((item): item is string => typeof item === "string").join("\n") : "",
    ambientesTexto: Array.isArray(source.ambientesPermitidos) ? source.ambientesPermitidos.filter((item): item is string => typeof item === "string").join("\n") : defaultValues.ambientesTexto,
  };
}

export function toDraft(values: WizardFormValues, analysis: ProductAnalysisDraft = {}): Draft {
  const list = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
  const finite = (value: string, min: number, max: number, integer = false) => {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const result = Number(trimmed);
    return Number.isFinite(result) && (!integer || Number.isInteger(result)) && result >= min && result <= max ? result : undefined;
  };
  const link = optional(values.linkProduto);
  return {
    nomeProduto: optional(values.nomeProduto),
    categoria: optional(values.categoria),
    descricaoPdp: optional(values.descricaoPdp),
    avaliacoes: optional(values.avaliacoes),
    notaMedia: finite(values.notaMedia, 0, 5),
    quantidadeAvaliacoes: finite(values.quantidadeAvaliacoes, 0, 10_000_000, true),
    precoAtual: optional(values.precoAtual),
    precoAnterior: optional(values.precoAnterior),
    especificacoesCriticas: list(values.especificacoesTexto),
    publicoAlvo: optional(values.publicoAlvo),
    perfilUgc: optional(values.perfilUgc),
    linkProduto: link && z.string().url().safeParse(link).success ? link : undefined,
    quantidadeCriativos: finite(values.quantidadeCriativos, 1, 8, true),
    ambientesPermitidos: list(values.ambientesTexto),
    politicaPreco: values.politicaPreco,
    duracaoTotal: values.duracaoTotal === "15" || values.duracaoTotal === "20" || values.duracaoTotal === "30" ? Number(values.duracaoTotal) as 15 | 20 | 30 : undefined,
    povComEmoji: values.povComEmoji,
    maxPalavrasPov: finite(values.maxPalavrasPov, 1, 30, true),
    quantidadeHashtags: finite(values.quantidadeHashtags, 1, 20, true),
    tomVoz: optional(values.tomVoz),
    ...analysis,
  };
}

export interface WizardServices {
  saveDraft(value: Draft): void;
  loadDraft(): Draft | null;
  listImages(): Promise<StoredImage[]>;
  putImage?(image: StoredImage): Promise<void>;
  deleteImage?(id: string): Promise<void>;
  extractProduct(form: FormData): Promise<ProductExtraction>;
  generate(form: FormData): Promise<GenerationEnvelope>;
  saveResult(id: string, result: GenerationEnvelope): Promise<void>;
  navigate(path: string): void;
}

async function responseCode(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { code?: string } | null;
  return body?.code ?? "UPSTREAM_UNAVAILABLE";
}

async function fetchProductExtraction(form: FormData): Promise<ProductExtraction> {
  const response = await fetch("/api/product-extraction", { method: "POST", body: form });
  if (!response.ok) throw new Error(await responseCode(response));
  return productExtractionSchema.parse(await response.json());
}

async function fetchGeneration(form: FormData): Promise<GenerationEnvelope> {
  const response = await fetch("/api/generate", { method: "POST", body: form });
  if (response.ok) return response.json();
  throw new Error(await responseCode(response));
}

const defaultServices: WizardServices = {
  saveDraft: draftStorage.save,
  loadDraft: draftStorage.load,
  listImages: assetStorage.listImages,
  putImage: assetStorage.putImage,
  deleteImage: assetStorage.deleteImage,
  extractProduct: fetchProductExtraction,
  generate: fetchGeneration,
  saveResult: async (id, result) => assetStorage.putResult({ ...result, id }),
  navigate: (path) => { window.location.assign(path); },
};

const stepFields: (keyof WizardFormValues)[][] = [
  ["nomeProduto", "categoria", "descricaoPdp"],
  ["perfilUgc"],
  ["quantidadeCriativos", "ambientesTexto", "maxPalavrasPov", "quantidadeHashtags", "tomVoz"],
];

const errorMessages: Record<string, string> = {
  API_NOT_CONFIGURED: "A API ainda não foi configurada.",
  INVALID_API_KEY: "A credencial Anthropic não é válida.",
  RATE_LIMITED: "O limite de uso foi atingido. Tente novamente em instantes.",
  REFUSAL: "A análise foi recusada. Troque as imagens e tente novamente.",
  TIMEOUT: "A análise demorou mais que o esperado.",
  INVALID_MODEL_OUTPUT: "A resposta recebida precisa ser analisada novamente.",
  INVALID_REQUEST: "As imagens selecionadas não puderam ser analisadas.",
  PAYLOAD_TOO_LARGE: "As imagens ultrapassam o tamanho permitido.",
  UPSTREAM_UNAVAILABLE: "O serviço está indisponível no momento.",
  TOO_MANY_SOURCES: "Remova imagens até atingir o máximo de 8 imagens antes de analisar.",
  IMAGE_LOAD_FAILED: "Não foi possível carregar as imagens salvas. Recarregue a página e tente novamente.",
  IMAGE_SAVE_FAILED: "Não foi possível salvar a alteração das imagens. Tente novamente.",
  STALE_ANALYSIS: "As imagens mudaram. Analise novamente antes de continuar.",
};
const submissionErrorMessages: Record<string, string> = {
  API_NOT_CONFIGURED: "A API ainda não foi configurada.",
  INVALID_API_KEY: "A credencial Anthropic não é válida.",
  RATE_LIMITED: "O limite de uso foi atingido. Tente novamente em instantes.",
  REFUSAL: "A geração foi recusada. Ajuste o briefing e tente novamente.",
  TIMEOUT: "A geração demorou mais que o esperado.",
  INVALID_MODEL_OUTPUT: "A resposta recebida precisa ser gerada novamente.",
  UPSTREAM_UNAVAILABLE: "O serviço está indisponível no momento.",
};
const emptyWarnings: string[] = [];

function extractionValues(current: WizardFormValues, extraction: ProductExtraction): WizardFormValues {
  return {
    ...current,
    nomeProduto: extraction.nomeProduto ?? "",
    categoria: extraction.categoria ?? "",
    descricaoPdp: extraction.descricaoPdp ?? "",
    avaliacoes: extraction.avaliacoes ?? "",
    notaMedia: extraction.notaMedia?.toString() ?? "",
    quantidadeAvaliacoes: extraction.quantidadeAvaliacoes?.toString() ?? "",
    precoAtual: extraction.precoAtual ?? "",
    precoAnterior: extraction.precoAnterior ?? "",
    especificacoesTexto: extraction.especificacoesCriticas.join("\n"),
    publicoAlvo: extraction.publicoAlvo ?? "",
  };
}

function failureCode(error: unknown): string {
  return error instanceof Error && error.message in errorMessages ? error.message : "UPSTREAM_UNAVAILABLE";
}

export function GenerationWizard({ services = defaultServices }: { services?: WizardServices }) {
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState<ReferenceError>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [editingSources, setEditingSources] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const restored = useRef(false);
  const skipInitialPersist = useRef(true);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDraft = useRef<Draft | null>(null);
  const [productAnalysis, setProductAnalysis] = useState<ProductAnalysisDraft>({});
  const extracting = useRef(false);
  const submitting = useRef(false);
  const form = useForm<WizardFormValues>({ defaultValues, resolver: zodResolver(formSchema) });
  const values = useWatch({ control: form.control });
  const profile = values.perfilUgc ?? "";
  const productSources = getProductSourceImages(images);
  const currentSelectionKey = imageSelectionKey(productSources);
  const productAnalysisKey = productAnalysis.productAnalysisKey;
  const productWarnings = productAnalysis.productExtractionWarnings ?? emptyWarnings;
  const analysisFresh = productSources.length > 0 && productSources.length <= 8 && productAnalysisKey === currentSelectionKey;
  const productState: ProductStepState = analyzing ? "analyzing" : analysisFresh && !editingSources ? "review" : "upload";

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const draft = services.loadDraft();
    if (draft) form.reset(fromDraft(draft));
    void Promise.resolve().then(() => {
      if (!cancelled && mounted.current) {
        setProductAnalysis(draft ? {
          productAnalysisKey: draft.productAnalysisKey,
          productExtractionWarnings: draft.productExtractionWarnings,
        } : {});
      }
    });
    restored.current = true;
    void services.listImages()
      .then((loaded) => {
        if (!cancelled && mounted.current) setImages(loaded);
      })
      .catch(() => {
        if (!cancelled && mounted.current) {
          setImageError({ load: true });
          setProductError("IMAGE_LOAD_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled && mounted.current) setImageLoading(false);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [form, services]);

  useEffect(() => {
    if (!restored.current || skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    const draft = toDraft(values as WizardFormValues, {
      productAnalysisKey,
      productExtractionWarnings: productWarnings.length ? productWarnings : undefined,
    });
    lastDraft.current = draft;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      services.saveDraft(draft);
      lastDraft.current = null;
      timer.current = null;
    }, 300);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [productAnalysisKey, productWarnings, services, values]);

  useEffect(() => () => {
    if (lastDraft.current) {
      services.saveDraft(lastDraft.current);
      lastDraft.current = null;
    }
  }, [services]);

  const flushDraft = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (lastDraft.current) {
      services.saveDraft(lastDraft.current);
      lastDraft.current = null;
    }
  };

  async function replaceProductSources(next: StoredImage[]) {
    const old = getProductSourceImages(images);
    setEditingSources(true);
    setProductError(null);
    try {
      await Promise.all(next.filter((item) => !old.some((existing) => existing.id === item.id)).map((item) => (services.putImage ?? assetStorage.putImage)(item)));
      await Promise.all(old.filter((item) => !next.some((current) => current.id === item.id)).map((item) => (services.deleteImage ?? assetStorage.deleteImage)(item.id)));
      setImages((current) => [...current.filter((item) => item.role !== "product" && item.role !== "ad"), ...next]);
    } catch {
      setProductError("IMAGE_SAVE_FAILED");
    }
  }

  async function replaceRole(role: ImageRole, next: StoredImage[]) {
    const old = images.filter((image) => image.role === role);
    try {
      await Promise.all(next.filter((item) => !old.some((existing) => existing.id === item.id)).map((item) => (services.putImage ?? assetStorage.putImage)(item)));
      await Promise.all(old.filter((item) => !next.some((current) => current.id === item.id)).map((item) => (services.deleteImage ?? assetStorage.deleteImage)(item.id)));
      setImages((current) => [...current.filter((item) => item.role !== role), ...next]);
      setImageError(null);
    } catch {
      setImageError({ save: true });
    }
  }

  async function analyzeProduct() {
    if (extracting.current) return;
    const sources = getProductSourceImages(images);
    if (!sources.length) return;
    if (sources.length > 8) {
      setProductError("TOO_MANY_SOURCES");
      return;
    }

    extracting.current = true;
    setAnalyzing(true);
    setProductError(null);
    const analyzedKey = imageSelectionKey(sources);
    try {
      const data = new FormData();
      for (const image of sources) data.append("source", new File([image.blob], image.name, { type: image.type }));
      const extraction = await services.extractProduct(data);
      if (!mounted.current) return;
      form.reset(extractionValues(form.getValues(), extraction));
      setProductAnalysis({
        productAnalysisKey: analyzedKey,
        productExtractionWarnings: extraction.avisos,
      });
      setEditingSources(false);
    } catch (error) {
      if (mounted.current) setProductError(failureCode(error));
    } finally {
      extracting.current = false;
      if (mounted.current) setAnalyzing(false);
    }
  }

  async function next() {
    if (step === 0 && (!analysisFresh || editingSources)) {
      setProductError("STALE_ANALYSIS");
      return;
    }
    const valid = await form.trigger(stepFields[step]);
    if (!valid) return;
    if (step === 1) {
      const ugcCount = images.filter((image) => image.role === "ugc").length;
      const issue = { ugcRequired: profile !== "sem_pessoa" && ugcCount < 1 };
      if (issue.ugcRequired) {
        setImageError(issue);
        return;
      }
    }
    setImageError(null);
    setStep((current) => Math.min(2, current + 1));
  }

  async function submit() {
    if (generating || submitting.current) return;
    submitting.current = true;
    if (!analysisFresh) {
      setStep(0);
      setEditingSources(true);
      setProductError("STALE_ANALYSIS");
      submitting.current = false;
      return;
    }
    const fieldsValid = await form.trigger();
    if (!fieldsValid) {
      submitting.current = false;
      return;
    }
    let input: GenerationInput;
    try {
      input = toInput(form.getValues());
    } catch {
      submitting.current = false;
      return;
    }
    const ugcCount = images.filter((image) => image.role === "ugc").length;
    if (input.perfilUgc !== "sem_pessoa" && !ugcCount) {
      setStep(1);
      setImageError({ ugcRequired: true });
      submitting.current = false;
      return;
    }

    setGenerating(true);
    setSubmissionError(null);
    try {
      const data = new FormData();
      data.set("payload", JSON.stringify(input));
      for (const image of getProductSourceImages(images)) {
        data.append(image.role, new File([image.blob], image.name, { type: image.type }));
      }
      const result = await services.generate(data);
      const id = crypto.randomUUID();
      await services.saveResult(id, result);
      flushDraft();
      services.navigate(`/resultado/${id}`);
    } catch (error) {
      const code = failureCode(error);
      setSubmissionError(submissionErrorMessages[code] ?? submissionErrorMessages.UPSTREAM_UNAVAILABLE);
    } finally {
      submitting.current = false;
      setGenerating(false);
    }
  }

  const names = ["Produto", "Referências", "Direção"];
  const productErrorContent = productError ? <>
    <span>{errorMessages[productError] ?? errorMessages.UPSTREAM_UNAVAILABLE}</span>
    {productError === "API_NOT_CONFIGURED"
      ? <a className={styles.inlineLink} href="/configuracoes">Abrir Configurações</a>
      : productError !== "TOO_MANY_SOURCES" && productError !== "STALE_ANALYSIS" && productError !== "IMAGE_LOAD_FAILED" && productError !== "IMAGE_SAVE_FAILED"
        ? <button className={styles.inlineButton} type="button" onClick={() => void analyzeProduct()}>Tentar novamente</button>
        : null}
  </> : null;

  return <main className={styles.page}>
    <div className={styles.container}>
      <header className={styles.wizardHeader}>
        <p className={styles.eyebrow}>Estúdio de criativos</p>
        <h1>Nova geração</h1>
        <p>Transforme as imagens do anúncio em um briefing factual, revise os dados e escolha a direção criativa.</p>
      </header>

      <nav className={styles.stepNav} aria-label="Etapas da geração">
        <ol className={styles.stepList}>
          {names.map((name, index) => <li className={styles.stepItem} key={name} aria-current={step === index ? "step" : undefined}>
            <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
            <span>{name}</span>
          </li>)}
        </ol>
      </nav>
      <p className={styles.currentStep} aria-live="polite">Etapa {step + 1} de 3: {names[step]}</p>

      <section className={styles.contentCard} aria-label={`Etapa ${names[step]}`}>
        {step === 0 && <ProductStep
          register={form.register}
          errors={form.formState.errors}
          images={productSources}
          state={productState}
          warnings={productWarnings}
          error={productErrorContent}
          onImagesChange={(next) => void replaceProductSources(next)}
          onAnalyze={() => void analyzeProduct()}
          onBackToImages={() => {
            setEditingSources(true);
            setProductError(null);
          }}
        />}
        {step === 1 && <ReferencesStep
          register={form.register}
          errors={form.formState.errors}
          profile={profile}
          images={images}
          loading={imageLoading}
          error={imageError}
          onImagesChange={replaceRole}
        />}
        {step === 2 && <DirectionStep register={form.register} errors={form.formState.errors} />}

        {submissionError && <div className={styles.submissionError} role="alert">
          <p>{submissionError}</p>
          {submissionError === submissionErrorMessages.API_NOT_CONFIGURED
            ? <a className={styles.inlineLink} href="/configuracoes">Abrir Configurações</a>
            : <button className={styles.inlineButton} type="button" onClick={() => void submit()}>Tentar novamente</button>}
        </div>}

        <footer className={styles.wizardActions}>
          {step > 0 && <button className={styles.backButton} type="button" onClick={() => setStep((current) => current - 1)} disabled={generating}>Voltar</button>}
          {step < 2
            ? <button className={styles.continueButton} type="button" onClick={() => void next()} disabled={generating || analyzing || (step === 0 && (!analysisFresh || editingSources))}>Continuar</button>
            : <button className={styles.continueButton} type="button" onClick={() => void submit()} disabled={generating}>{generating ? "Gerando…" : "Gerar criativos"}</button>}
        </footer>
      </section>
    </div>
  </main>;
}
