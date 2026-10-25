import { ArrowLeft, ArrowRight, ImagePlus, MoreHorizontal, Pencil, Play, Plus, Timer, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Form, Label, Menu, MenuItem, MenuTrigger, Popover, Radio, RadioGroup } from "react-aria-components";
import { api, escolherArquivoParaAnexar, type Passo, type Rotina } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useFoco } from "../foco/Foco";
import { EditarTexto } from "../paginas/Ideias";
import { ImagemAnexo } from "../relacoes/Relacoes";
import { textos } from "../textos/pt-BR";
import { ICONES } from "./icones";

const t = textos.rotinas;

function IconePasso({ nome, tamanho = "1.2em" }: { nome: string; tamanho?: string }) {
  const item = ICONES[nome];
  if (!item) return null;
  const Icone = item.icone;
  return <Icone aria-hidden="true" size={tamanho} strokeWidth={1.75} />;
}

export function Rotinas() {
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [fazendo, setFazendo] = useState<Rotina | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarRotinas().then(setRotinas, (e) => setErro(String(e?.message ?? e)));
  }, [mudancas]);

  const rotinaEditada = rotinas.find((r) => r.id === editando);
  if (rotinaEditada) return <EditarRotina rotina={rotinaEditada} aoVoltar={() => setEditando(null)} />;

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>
      <Button className="botao principal" onPress={() => setCriando(true)}>
        <Plus aria-hidden="true" size="1.1em" /> {t.nova}
      </Button>
      <Aviso>{erro}</Aviso>
      {rotinas.length === 0 ? (
        <p className="texto-suave">{t.vazio}</p>
      ) : (
        <ul className="lista-cartoes largura-leitura">
          {rotinas.map((r) => (
            <li key={r.id} className="cartao compacto">
              <div className="linha-ajuste">
                <div>
                  <p className="cartao-projeto-titulo quebra">{r.titulo}</p>
                  <p className="texto-suave pequeno">{t.passos(r.passos.length)}</p>
                </div>
                <div className="botoes">
                  <Button className="botao principal" isDisabled={r.passos.length === 0} onPress={() => setFazendo(r)}>
                    <Play aria-hidden="true" size="1.1em" /> {t.comecar}
                  </Button>
                  <Button className="botao" onPress={() => setEditando(r.id)}>
                    <Pencil aria-hidden="true" size="1.1em" /> {t.editar}
                  </Button>
                </div>
              </div>
              {r.passos.length > 0 && (
                <ol className="passos-resumo">
                  {r.passos.map((p) => (
                    <li key={p.id}>
                      <IconePasso nome={p.icone} tamanho="1em" /> {p.titulo}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}

      <Janela titulo={t.nova} aberta={criando} aoFechar={() => setCriando(false)}>
        <EditarTexto
          inicial=""
          rotulo={t.nomeDaRotina}
          aoCancelar={() => setCriando(false)}
          aoSalvar={async (titulo) => {
            try {
              const r = await api.criarRotina(titulo);
              setCriando(false);
              avisarMudanca();
              setEditando(r.id);
            } catch (e) {
              setErro(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      </Janela>
      {fazendo && <FazerRotina rotina={fazendo} aoFechar={() => setFazendo(null)} />}
    </div>
  );
}

function EditarRotina({ rotina, aoVoltar }: { rotina: Rotina; aoVoltar: () => void }) {
  const [passo, setPasso] = useState<Passo | null>(null);
  const [janela, setJanela] = useState<"renomear" | "excluir" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
      avisarMudanca();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="pagina">
      <Button className="link voltar" onPress={aoVoltar}>
        <ArrowLeft aria-hidden="true" size="1em" /> {t.titulo}
      </Button>
      <h1 className="quebra">{rotina.titulo}</h1>
      <div className="botoes">
        <Button className="botao principal" onPress={() => setPasso({ id: "", titulo: "", icone: "", minutos: null })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.novoPasso}
        </Button>
        <Button className="botao" onPress={() => setJanela("renomear")}>{t.renomear}</Button>
        <Button className="botao" onPress={() => setJanela("excluir")}>
          <Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}
        </Button>
      </div>
      <Aviso>{erro}</Aviso>
      {rotina.passos.length === 0 ? (
        <p className="texto-suave">{t.semPassos}</p>
      ) : (
        <ol className="lista-passos largura-leitura">
          {rotina.passos.map((p, i) => (
            <li key={p.id} className="passo-linha">
              <span className="passo-numero">{i + 1}</span>
              <span className="passo-icone">
                {p.imagem ? <ImagemAnexo id={p.imagem} nome="" className="passo-imagem" /> : <IconePasso nome={p.icone} />}
              </span>
              <span className="passo-titulo quebra">{p.titulo}</span>
              <span className="texto-suave pequeno">{p.minutos ? t.min(p.minutos) : ""}</span>
              <MenuTrigger>
                <Button className="botao-icone" aria-label={t.acoesPasso(p.titulo)}>
                  <MoreHorizontal aria-hidden="true" size="1.1em" />
                </Button>
                <Popover className="menu-popover" placement="bottom end">
                  <Menu
                    className="menu"
                    onAction={(acao) => {
                      if (acao === "editar") setPasso(p);
                      if (acao === "subir") void executar(() => api.moverTarefa(p.id, rotina.passos[i - 1].id));
                      if (acao === "descer") void executar(() => api.moverTarefa(p.id, rotina.passos[i + 2]?.id ?? null));
                      if (acao === "excluir") void executar(() => api.excluirItem(p.id));
                    }}
                  >
                    <MenuItem id="editar" className="menu-item">{t.editar}</MenuItem>
                    {i > 0 && <MenuItem id="subir" className="menu-item">{t.subir}</MenuItem>}
                    {i < rotina.passos.length - 1 && <MenuItem id="descer" className="menu-item">{t.descer}</MenuItem>}
                    <MenuItem id="excluir" className="menu-item">{t.excluirPasso}</MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </li>
          ))}
        </ol>
      )}

      <Janela titulo={passo?.id ? t.editarPasso : t.novoPasso} aberta={!!passo} aoFechar={() => setPasso(null)}>
        {passo && (
          <FormPasso
            inicial={passo}
            aoCancelar={() => setPasso(null)}
            aoSalvar={(p, imagem) =>
              executar(async () => {
                const salvo = await api.salvarPasso(rotina.id, p);
                // A imagem é um anexo do passo: trocar = tirar a antiga e anexar a nova.
                if (imagem !== undefined && passo.imagem) await api.excluirAnexo(passo.imagem);
                if (imagem) await api.anexarArquivo(salvo.id, imagem);
                setPasso(null);
              })
            }
          />
        )}
      </Janela>
      <Janela titulo={t.renomear} aberta={janela === "renomear"} aoFechar={() => setJanela(null)}>
        <EditarTexto
          inicial={rotina.titulo}
          rotulo={t.nomeDaRotina}
          aoCancelar={() => setJanela(null)}
          aoSalvar={(titulo) => executar(async () => (await api.renomear(rotina.id, titulo), setJanela(null)))}
        />
      </Janela>
      <Confirmar
        titulo={t.excluirTitulo}
        texto={t.excluirTexto}
        confirmar={t.excluir}
        aberta={janela === "excluir"}
        aoCancelar={() => setJanela(null)}
        aoConfirmar={() => executar(async () => (await api.excluirItem(rotina.id), setJanela(null), aoVoltar()))}
      />
    </div>
  );
}

/** `imagem` ao salvar: undefined = não mexe; null = tira; texto = caminho da nova. */
function FormPasso({ inicial, aoCancelar, aoSalvar }: { inicial: Passo; aoCancelar: () => void; aoSalvar: (p: Passo, imagem: string | null | undefined) => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [imagem, setImagem] = useState<string | null | undefined>(undefined);
  const nomeArquivo = (c: string) => c.split(/[\\/]/).pop() ?? c;
  const temImagem = imagem ? true : imagem === null ? false : !!inicial.imagem;
  const [minutos, setMinutos] = useState(inicial.minutos ? String(inicial.minutos) : "");
  const [icone, setIcone] = useState(inicial.icone);
  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const m = parseInt(minutos, 10);
        if (titulo.trim()) aoSalvar({ ...inicial, titulo, icone, minutos: m > 0 ? m : null }, imagem);
      }}
    >
      <Campo rotulo={t.oQueFazer} valor={titulo} aoMudar={setTitulo} autoFocus />
      <Campo rotulo={t.minutos} valor={minutos} aoMudar={(v) => setMinutos(v.replace(/\D/g, "").slice(0, 3))} numerico />
      <fieldset className="grupo-campos">
        <legend className="campo-rotulo">{t.imagem}</legend>
        <p className="campo-ajuda">{t.imagemAjuda}</p>
        {imagem === undefined && inicial.imagem && <ImagemAnexo id={inicial.imagem} nome="" className="passo-imagem-previa" />}
        {imagem && <p className="pequeno">{t.imagemEscolhida(nomeArquivo(imagem))}</p>}
        {imagem === null && inicial.imagem && <p className="pequeno">{t.semImagem}</p>}
        <div className="botoes">
          <Button
            className="botao pequeno com-icone"
            onPress={async () => {
              const c = await escolherArquivoParaAnexar(true);
              if (c) setImagem(c);
            }}
          >
            <ImagePlus aria-hidden="true" size="1em" /> {temImagem ? t.trocarImagem : t.escolherImagem}
          </Button>
          {temImagem && (
            <Button className="botao pequeno" onPress={() => setImagem(null)}>{t.tirarImagem}</Button>
          )}
        </div>
      </fieldset>
      <RadioGroup className="campo" value={icone} onChange={setIcone}>
        <Label className="campo-rotulo">{t.icone}</Label>
        <div className="grade-icones">
          <Radio value="" className="opcao-icone">
            <X aria-hidden="true" size="1.2em" />
            <span>{t.semIcone}</span>
          </Radio>
          {Object.entries(ICONES).map(([chave, { icone: Icone, nome }]) => (
            <Radio key={chave} value={chave} className="opcao-icone">
              <Icone aria-hidden="true" size="1.2em" strokeWidth={1.75} />
              <span>{nome}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit" isDisabled={!titulo.trim()}>{textos.comum.salvar}</Button>
      </div>
    </Form>
  );
}

/** Um passo por vez, em letra grande. Sem contagem de sequência, sem cobrança. */
function FazerRotina({ rotina, aoFechar }: { rotina: Rotina; aoFechar: () => void }) {
  const [atual, setAtual] = useState(0);
  const foco = useFoco();
  const feita = atual >= rotina.passos.length;
  const passo = rotina.passos[atual];

  return (
    <Janela titulo={rotina.titulo} aberta aoFechar={aoFechar}>
      {feita ? (
        <div className="fazer-rotina">
          <p className="fazer-titulo">{t.feita}</p>
          <p className="texto-suave">{t.feitaTexto}</p>
          <div className="janela-acoes">
            <Button className="botao principal" autoFocus onPress={aoFechar}>{t.fechar}</Button>
          </div>
        </div>
      ) : (
        <div className="fazer-rotina">
          <p className="acesso-passo">{t.passoDe(atual + 1, rotina.passos.length)}</p>
          <div className="fazer-passo" aria-live="polite">
            {passo.imagem ? (
              <ImagemAnexo id={passo.imagem} nome="" className="fazer-imagem" />
            ) : (
              passo.icone && <IconePasso nome={passo.icone} tamanho="3rem" />
            )}
            <p className="fazer-titulo quebra">{passo.titulo}</p>
            {passo.minutos && (
              <Button className="botao" onPress={() => foco.comecar(passo.minutos!, passo.titulo)}>
                <Timer aria-hidden="true" size="1.1em" /> {t.usarTimer(passo.minutos)}
              </Button>
            )}
          </div>
          <div className="janela-acoes">
            <Button className="botao separado" onPress={aoFechar}>{t.sair}</Button>
            {atual > 0 && (
              <Button className="botao" onPress={() => setAtual(atual - 1)}>
                <ArrowLeft aria-hidden="true" size="1.1em" /> {t.voltar}
              </Button>
            )}
            <Button className="botao principal" autoFocus onPress={() => setAtual(atual + 1)}>
              {t.proximo} <ArrowRight aria-hidden="true" size="1.1em" />
            </Button>
          </div>
        </div>
      )}
    </Janela>
  );
}
