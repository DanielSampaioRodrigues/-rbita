// Seletor de fonte do editor (como o do Word e do Pages): um botão com o nome da
// fonte, escrito nela, que abre a lista com busca. Cada nome aparece na própria
// fonte, em grupos: normas acadêmicas, do Órbita, mais fontes e deste aparelho.
// Dá para digitar o nome de uma fonte que não está na lista e usar assim mesmo.
import { useEffect, useMemo, useState } from "react";
import { Autocomplete, Button, Dialog, DialogTrigger, Header, Input, Menu, MenuItem, MenuSection, Popover, SearchField } from "react-aria-components";
import { Check, ChevronDown, Search } from "../../icones";
import { textos } from "../../textos/pt-BR";
import { acharFonte, casa, cssDoAparelho, fontesDoAparelho, montarLista, pedirFontesDoComputador, podePedirFontes, primeiraFamilia, temFonte, type FonteDoc, type GrupoFonte } from "./fontes";

const t = textos.caderno.editor;
const GRUPOS: GrupoFonte[] = ["normas", "orbita", "mais", "aparelho"];

export function SeletorFonte({ atual, aoEscolher }: {
  /** O CSS da fonte no ponto do cursor ("" = a fonte do estilo). */
  atual: string;
  /** `null` volta para a fonte do estilo. */
  aoEscolher: (css: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [doAparelho, setDoAparelho] = useState<string[]>([]);
  // A lista do aparelho é lida na primeira vez que a pessoa abre.
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    void fontesDoAparelho().then((l) => { if (vivo) setDoAparelho(l); });
    return () => { vivo = false; };
  }, [aberto]);
  const lista = useMemo(() => montarLista(doAparelho), [doAparelho]);
  const escolhida = atual ? acharFonte(lista, atual) : undefined;
  const nomeAtual = atual ? (escolhida?.nome ?? primeiraFamilia(atual)) : t.fontePadrao;
  // Fonte de outro aparelho que não está na lista: avisa, sem mudar nada.
  const ausente = useMemo(() => !!atual && !escolhida && !temFonte(primeiraFamilia(atual)), [atual, escolhida]);
  const exata = lista.some((f) => f.nome.toLowerCase() === busca.trim().toLowerCase());
  const escolher = (css: string | null) => {
    setAberto(false);
    setBusca("");
    // Depois de a lista fechar (o foco volta para o texto, com a seleção de antes).
    setTimeout(() => aoEscolher(css), 0);
  };
  const porId = (id: string) => {
    if (id === "padrao") return escolher(null);
    if (id === "usar") return escolher(cssDoAparelho(busca.trim()));
    const f = lista[Number(id)];
    if (f) escolher(f.css);
  };
  const grupos = GRUPOS.map((g) => ({ g, fontes: lista.map((f, i) => ({ f, i })).filter(({ f }) => f.grupo === g) })).filter((x) => x.fontes.length);
  const tocar = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return (
    <DialogTrigger isOpen={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setBusca(""); }}>
      <Button className="fita-select largo fita-fonte" aria-label={`${t.fonte}: ${nomeAtual}`}>
        <span className="fita-fonte-nome" style={{ fontFamily: atual || undefined }}>{ausente ? t.fontes.ausente(nomeAtual) : nomeAtual}</span>
        <ChevronDown size="0.8em" aria-hidden="true" />
      </Button>
      <Popover className="menu-popover fita-fontes" placement="bottom start">
        <Dialog className="fita-fontes-dialogo" aria-label={t.fonte}>
          <Autocomplete inputValue={busca} onInputChange={setBusca} filter={(texto, b) => casa(texto, b)}>
            <SearchField className="fita-fontes-busca" aria-label={t.fontes.buscar} autoFocus={!tocar}>
              <Search size="1em" aria-hidden="true" />
              <Input className="entrada-texto" placeholder={t.fontes.buscar} />
            </SearchField>
            <Menu className="fita-fontes-lista" aria-label={t.fonte} onAction={(k) => porId(String(k))}
              renderEmptyState={() => <p className="fita-fontes-vazio">{t.fontes.nenhuma}</p>}>
              <MenuItem id="padrao" className="menu-item fita-fonte-item" textValue={t.fontePadrao}>
                <span>{t.fontePadrao}</span>{!atual && <Check size="1em" aria-hidden="true" />}
              </MenuItem>
              {grupos.map(({ g, fontes }) => (
                <MenuSection key={g} className="fita-fontes-grupo">
                  <Header className="fita-fontes-titulo">{t.fontes.grupos[g]}</Header>
                  {fontes.map(({ f, i }) => <ItemFonte key={`${g}-${f.nome}`} id={String(i)} fonte={f} atual={escolhida === f} />)}
                </MenuSection>
              ))}
              {busca.trim() && !exata ? (
                <MenuItem id="usar" className="menu-item fita-fonte-item" textValue={`${t.fontes.usar(busca.trim())} ${busca}`}>
                  <span style={{ fontFamily: cssDoAparelho(busca.trim()) }}>{t.fontes.usar(busca.trim())}</span>
                </MenuItem>
              ) : null}
            </Menu>
          </Autocomplete>
          {podePedirFontes() && (
            <Button className="botao pequeno fita-fontes-computador" onPress={() => { void pedirFontesDoComputador().then(setDoAparelho).catch(() => undefined); }}>
              {t.fontes.computador}
            </Button>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function ItemFonte({ id, fonte, atual }: { id: string; fonte: FonteDoc; atual: boolean }) {
  return (
    <MenuItem id={id} className="menu-item fita-fonte-item" textValue={fonte.nome}>
      <span className="fita-fonte-amostra" style={{ fontFamily: fonte.css }}>{fonte.nome}</span>
      {fonte.nota && <span className="fita-fonte-nota">{fonte.nota}</span>}
      {atual && <Check size="1em" aria-hidden="true" />}
    </MenuItem>
  );
}
