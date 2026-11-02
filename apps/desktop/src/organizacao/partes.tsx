// Peças de "Minha organização" usadas em mais de um lugar: escolha de cor,
// etiqueta, capa e os sinais do cartão fechado (data, checklist, anexos, descrição).
import { useEffect, useState } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";
import { api, type CartaoOrg, type EtiquetaOrg } from "../api";
import { dadosParaBlobUrl } from "../hobbies/midia";
import { AlignLeft, CalendarDays, Check, ListChecks, Paperclip } from "../icones";
import { textos } from "../textos/pt-BR";
import { CORES_ORG, PALETA_ORG, classeCor, eCorOrg, estiloCor } from "./cores";
import { progresso, situacaoPrazo, textoPrazo } from "./regras";

const t = textos.organizacao;

/** Escolha de cor com amostras que já mostram o fundo e o texto como vão ficar. */
export function EscolherCor({ rotulo, valor, aoMudar, ajuda = t.corAjuda, semVazio }: { rotulo: string; valor: string; aoMudar: (c: string) => void; ajuda?: string; semVazio?: boolean }) {
  return (
    <RadioGroup className="campo" value={valor} onChange={aoMudar} orientation="horizontal">
      <Label className="campo-rotulo">{rotulo}</Label>
      <div className="org-cores">
        {!semVazio && (
          <Radio value="" className="org-cor-opcao" aria-label={t.semCor}>
            <span className="org-amostra org-amostra-vazia" aria-hidden="true">{t.amostra}</span>
            <span className="org-cor-nome">{t.semCor}</span>
          </Radio>
        )}
        {CORES_ORG.map((c) => (
          <Radio key={c} value={c} className="org-cor-opcao" aria-label={t.cores[c]}>
            <span className={"org-amostra" + classeCor(c)} style={estiloCor(c)} aria-hidden="true">{t.amostra}</span>
            <span className="org-cor-nome">{t.cores[c]}</span>
          </Radio>
        ))}
      </div>
      {ajuda && <p className="campo-ajuda">{ajuda}</p>}
    </RadioGroup>
  );
}

/** Etiqueta: cor e nome juntos (a cor nunca é o único sinal). */
export function ChipEtiqueta({ etiqueta, pequena }: { etiqueta: EtiquetaOrg; pequena?: boolean }) {
  const nome = etiqueta.nome || t.etiquetas.semNome;
  return (
    <span className={"org-etiqueta" + classeCor(etiqueta.cor) + (pequena ? " pequena" : "")} style={estiloCor(etiqueta.cor)}>
      {nome}
    </span>
  );
}

// Imagens de anexo (capa, fundo): uma leitura por id, guardada enquanto o app está aberto.
const imagens = new Map<string, Promise<string>>();

/** Endereço (blob) da imagem de um anexo; null enquanto carrega ou se falhar. */
export function useImagemAnexo(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return setUrl(null);
    let vivo = true;
    let pedido = imagens.get(id);
    if (!pedido) {
      pedido = api.imagemAnexo(id).then(dadosParaBlobUrl);
      pedido.catch(() => imagens.delete(id));
      imagens.set(id, pedido);
    }
    pedido.then((u) => vivo && setUrl(u), () => vivo && setUrl(null));
    return () => void (vivo = false);
  }, [id]);
  return url;
}

/** Capa no topo do cartão: faixa de cor ou imagem. */
export function CapaCartao({ capa, grande }: { capa: CartaoOrg["capa"]; grande?: boolean }) {
  const ehImagem = capa?.tipo === "imagem";
  const url = useImagemAnexo(ehImagem ? capa!.valor : "");
  if (!capa || !capa.tipo || !capa.valor) return null;
  if (capa.tipo === "cor") {
    if (!eCorOrg(capa.valor)) return null;
    const p = PALETA_ORG[capa.valor];
    return <div className={"org-capa org-capa-cor" + (grande ? " grande" : "")} style={{ "--org-capa-c": p.claro, "--org-capa-e": p.escuro } as React.CSSProperties} aria-hidden="true" />;
  }
  return (
    <div className={"org-capa org-capa-imagem" + (grande ? " grande" : "")} aria-hidden="true">
      {url ? <img src={url} alt="" /> : <span className="imagem-carregando" />}
    </div>
  );
}

/** Data de entrega com destaque suave (nunca vermelho gritante). */
export function SeloPrazo({ cartao, agora }: { cartao: CartaoOrg; agora: Date }) {
  if (!cartao.prazo) return null;
  const sit = situacaoPrazo(cartao.prazo, cartao.hora ?? "", cartao.feito, agora);
  const texto = textoPrazo(cartao.prazo, cartao.hora ?? "", agora);
  const palavra = sit === "atrasado" ? t.cartao.vencido : sit === "hoje" ? t.cartao.vencehoje : sit === "perto" ? t.cartao.perto : sit === "feito" ? t.cartao.concluido : "";
  return (
    <span className={`org-selo org-prazo prazo-${sit}`} title={t.cartao.prazoRotulo(texto, palavra)}>
      {sit === "feito" ? <Check aria-hidden="true" size="0.95em" /> : <CalendarDays aria-hidden="true" size="0.95em" />}
      <span className="visualmente-oculto">{t.cartao.prazoRotulo(texto, palavra)}</span>
      <span aria-hidden="true">{texto}</span>
    </span>
  );
}

/** Os sinais do cartão fechado: data, descrição, checklist e anexos. */
export function SinaisCartao({ cartao, agora }: { cartao: CartaoOrg; agora: Date }) {
  const p = progresso(cartao);
  const temDescricao = !!cartao.descricao?.trim();
  const anexos = cartao.anexos ?? 0;
  if (!cartao.prazo && !temDescricao && !p.total && !anexos) return null;
  return (
    <span className="org-sinais">
      <SeloPrazo cartao={cartao} agora={agora} />
      {temDescricao && (
        <span className="org-selo" title={t.cartao.temDescricao}>
          <AlignLeft aria-hidden="true" size="0.95em" />
          <span className="visualmente-oculto">{t.cartao.temDescricao}</span>
        </span>
      )}
      {p.total > 0 && (
        <span className={"org-selo" + (p.feitos === p.total ? " completo" : "")} title={t.cartao.checklistDe(p.feitos, p.total)}>
          <ListChecks aria-hidden="true" size="0.95em" />
          <span className="visualmente-oculto">{t.cartao.checklistDe(p.feitos, p.total)}</span>
          <span aria-hidden="true">{p.feitos}/{p.total}</span>
        </span>
      )}
      {anexos > 0 && (
        <span className="org-selo" title={t.cartao.temAnexos(anexos)}>
          <Paperclip aria-hidden="true" size="0.95em" />
          <span className="visualmente-oculto">{t.cartao.temAnexos(anexos)}</span>
          <span aria-hidden="true">{anexos}</span>
        </span>
      )}
    </span>
  );
}

/** As etiquetas aplicadas ao cartão, na ordem do quadro. */
export function EtiquetasCartao({ ids, todas }: { ids: string[] | undefined; todas: EtiquetaOrg[] }) {
  const lista = todas.filter((e) => ids?.includes(e.id));
  if (!lista.length) return null;
  return (
    <span className="org-etiquetas">
      {lista.map((e) => <ChipEtiqueta key={e.id} etiqueta={e} pequena />)}
    </span>
  );
}
