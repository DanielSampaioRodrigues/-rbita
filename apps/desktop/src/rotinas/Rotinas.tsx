import { ArrowLeft, ArrowRight, Check, ImagePlus, MoreHorizontal, Pencil, Play, Plus, Timer, Trash2, X } from "../icones";
import { useEffect, useState, type CSSProperties } from "react";
import { Button, Checkbox, CheckboxGroup, Form, Label, Menu, MenuItem, MenuTrigger, Popover, ProgressBar, Radio, RadioGroup } from "react-aria-components";
import { api, escolherArquivoParaAnexar, type Passo, type Rotina } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { avisarMudanca, useMudancas } from "../dados";
import { useFoco } from "../foco/Foco";
import { EditarTexto } from "../paginas/Ideias";
import { ImagemAnexo } from "../relacoes/Relacoes";
import { textos } from "../textos/pt-BR";
import { ICONES } from "./icones";
import {
  PALETA, hexDaCor, limparEmoji, marcarPasso, passosFeitosHoje, personalizacaoDe, resumoDeDias,
  salvarPersonalizacao, textoSobre, useRotinasGuardadas, valeNoDia, type Personalizacao,
} from "./personalizacao";

const t = textos.rotinas;

function IconePasso({ nome, tamanho = "1.2em" }: { nome: string; tamanho?: string }) {
  const item = ICONES[nome];
  if (!item) return null;
  const Icone = item.icone;
  return <Icone aria-hidden="true" size={tamanho} strokeWidth={1.75} />;
}

/** Ícone da lista ou, se for outra coisa, o emoji que a pessoa escreveu. */
function Simbolo({ nome, tamanho = "1.2em" }: { nome?: string | null; tamanho?: string }) {
  if (!nome) return null;
  if (ICONES[nome]) return <IconePasso nome={nome} tamanho={tamanho} />;
  return <span aria-hidden="true" className="rotina-emoji">{nome}</span>;
}

/** Quadradinho da rotina: cor suave com o ícone, texto sempre com contraste automático. */
function Marca({ p }: { p: Personalizacao }) {
  const hex = hexDaCor(p.cor);
  if (!hex && !p.icone) return null;
  const estilo = hex ? { background: hex, color: textoSobre(hex), borderColor: hex } : undefined;
  return (
    <span className={hex ? "rotina-marca" : "rotina-marca sem-cor"} style={estilo}>
      {p.icone ? <Simbolo nome={p.icone} tamanho="1.5rem" /> : <Check aria-hidden="true" size="1.3rem" />}
    </span>
  );
}

function estiloDaCor(p: Personalizacao) {
  const hex = hexDaCor(p.cor);
  return hex ? ({ "--rotina-cor": hex } as CSSProperties) : undefined;
}

/** Cartão de uma rotina: quem é, quantos passos, o que já foi marcado hoje (sem cobrança). */
function CartaoRotina({ rotina, aoComecar, aoEditar }: { rotina: Rotina; aoComecar: () => void; aoEditar: () => void }) {
  useRotinasGuardadas();
  const p = personalizacaoDe(rotina);
  const feitos = passosFeitosHoje(rotina.id);
  const total = rotina.passos.length;
  const feitosValidos = rotina.passos.filter((x) => feitos.includes(x.id)).length;
  const vale = valeNoDia(p.dias, new Date().getDay());
  const detalhes = [t.passos(total), resumoDeDias(p.dias ?? []), p.horario ? t.aPartirDe(p.horario) : ""].filter(Boolean);

  return (
    <li className="cartao compacto rotina-cartao" data-cor={hexDaCor(p.cor) ? "sim" : "nao"} data-fora-de-hoje={!vale} style={estiloDaCor(p)}>
      <div className="rotina-cabeca">
        <Marca p={p} />
        <div className="rotina-cabeca-texto">
          <p className="cartao-projeto-titulo quebra">{rotina.titulo}</p>
          <p className="texto-suave pequeno">{detalhes.join(" · ")}</p>
          {!vale && <p className="rotina-etiqueta">{t.foraDeHoje}</p>}
        </div>
        <div className="botoes">
          <Button className="botao principal" isDisabled={total === 0} onPress={aoComecar}>
            <Play aria-hidden="true" size="1.1em" /> {t.comecar}
          </Button>
          <Button className="botao" onPress={aoEditar}>
            <Pencil aria-hidden="true" size="1.1em" /> {t.editar}
          </Button>
        </div>
      </div>
      {total > 0 ? (
        <>
          <ProgressBar className="rotina-progresso" value={feitosValidos} minValue={0} maxValue={total} aria-label={t.hojeProgresso(feitosValidos, total)}>
            {({ percentage }) => (
              <>
                <span className="texto-suave pequeno">{t.hojeProgresso(feitosValidos, total)}</span>
                <span className="rotina-trilho" aria-hidden="true">
                  <span className="rotina-preenchido" style={{ width: `${percentage}%` }} />
                </span>
              </>
            )}
          </ProgressBar>
          <ul className="rotina-passos">
            {rotina.passos.map((x) => {
              const feito = feitos.includes(x.id);
              return (
                <li key={x.id}>
                  <Checkbox
                    className="rotina-passo"
                    isSelected={feito}
                    onChange={(v) => {
                      marcarPasso(rotina.id, x.id, v);
                    }}
                    aria-label={t.marcarPasso(x.titulo)}
                  >
                    <span className="rotina-caixa" aria-hidden="true">
                      <Check size="1.1rem" strokeWidth={3} />
                    </span>
                    <span className="rotina-passo-icone">
                      {x.imagem ? <ImagemAnexo id={x.imagem} nome="" className="passo-imagem" /> : <IconePasso nome={x.icone} tamanho="1.2em" />}
                    </span>
                    <span className="rotina-passo-titulo quebra">{x.titulo}</span>
                    {x.minutos ? <span className="texto-suave pequeno">{t.min(x.minutos)}</span> : null}
                  </Checkbox>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="texto-suave">{t.vazioPassos}</p>
      )}
    </li>
  );
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
        <div className="rotina-vazio largura-leitura">
          <p className="rotina-vazio-titulo">{t.vazioTitulo}</p>
          <p className="texto-suave">{t.vazio}</p>
          <ol className="rotina-vazio-passos">
            <li>{t.vazioPasso1}</li>
            <li>{t.vazioPasso2}</li>
            <li>{t.vazioPasso3}</li>
          </ol>
        </div>
      ) : (
        <ul className="lista-cartoes largura-leitura rotina-lista">
          {rotinas.map((r) => (
            <CartaoRotina key={r.id} rotina={r} aoComecar={() => setFazendo(r)} aoEditar={() => setEditando(r.id)} />
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
  const [janela, setJanela] = useState<"renomear" | "excluir" | "personalizar" | null>(null);
  useRotinasGuardadas();
  const pers = personalizacaoDe(rotina);
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
      <div className="rotina-titulo-linha" style={estiloDaCor(pers)}>
        <Marca p={pers} />
        <div className="rotina-cabeca-texto">
          <h1 className="quebra">{rotina.titulo}</h1>
          <p className="texto-suave pequeno">
            {[resumoDeDias(pers.dias ?? []), pers.horario ? t.aPartirDe(pers.horario) : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="botoes">
        <Button className="botao principal" onPress={() => setPasso({ id: "", titulo: "", icone: "", minutos: null })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.novoPasso}
        </Button>
        <Button className="botao" onPress={() => setJanela("personalizar")}>{t.personalizar}</Button>
        <Button className="botao" onPress={() => setJanela("renomear")}>{t.renomear}</Button>
        <Button className="botao" onPress={() => setJanela("excluir")}>
          <Trash2 aria-hidden="true" size="1.1em" /> {t.excluir}
        </Button>
      </div>
      <Aviso>{erro}</Aviso>
      {rotina.passos.length === 0 ? (
        <p className="texto-suave">{t.vazioPassos}</p>
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
      <Janela titulo={t.personalizarTitulo} aberta={janela === "personalizar"} aoFechar={() => setJanela(null)}>
        <FormPersonalizar
          inicial={pers}
          aoCancelar={() => setJanela(null)}
          aoSalvar={(novo) => {
            salvarPersonalizacao(rotina.id, novo);
            setJanela(null);
            avisarMudanca();
          }}
        />
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

/** Cor, ícone ou emoji, dias e horário. Tudo opcional. */
function FormPersonalizar({ inicial, aoCancelar, aoSalvar }: { inicial: Personalizacao; aoCancelar: () => void; aoSalvar: (p: Personalizacao) => void }) {
  const [cor, setCor] = useState(inicial.cor ?? "");
  const [icone, setIcone] = useState(inicial.icone ?? "");
  const [dias, setDias] = useState((inicial.dias ?? []).map(String));
  const [horario, setHorario] = useState(inicial.horario ?? "");
  const ehEmoji = !!icone && !ICONES[icone];
  return (
    <Form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar({ cor: cor || null, icone: icone || null, dias: dias.map(Number).sort(), horario: horario || null });
      }}
    >
      <RadioGroup className="campo" value={cor} onChange={setCor}>
        <Label className="campo-rotulo">{t.cor}</Label>
        <div className="rotina-cores">
          <Radio value="" className="rotina-cor-opcao">
            <span className="rotina-cor-amostra sem-cor" aria-hidden="true"><X size="1.1rem" /></span>
            <span>{t.semCor}</span>
          </Radio>
          {PALETA.map((c) => (
            <Radio key={c.id} value={c.id} className="rotina-cor-opcao">
              <span className="rotina-cor-amostra" style={{ background: c.hex, color: textoSobre(c.hex) }} aria-hidden="true">
                <Check size="1.1rem" strokeWidth={3} />
              </span>
              <span>{c.nome}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <RadioGroup className="campo" value={ehEmoji ? "" : icone} onChange={setIcone}>
        <Label className="campo-rotulo">{t.simbolo}</Label>
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
      <Campo rotulo={t.emoji} valor={ehEmoji ? icone : ""} aoMudar={(v) => setIcone(limparEmoji(v))} descricao={t.emojiAjuda} semDitado />

      <CheckboxGroup className="campo" value={dias} onChange={setDias}>
        <Label className="campo-rotulo">{t.dias}</Label>
        <p className="campo-ajuda">{t.diasAjuda}</p>
        <div className="rotina-dias">
          {t.nomesDias.map((nome, i) => (
            <Checkbox key={nome} value={String(i)} className="rotina-dia">
              {nome}
            </Checkbox>
          ))}
        </div>
      </CheckboxGroup>

      <label className="campo">
        <span className="campo-rotulo">{t.horario}</span>
        <input className="entrada-texto rotina-horario" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
        <span className="campo-ajuda">{t.horarioAjuda}</span>
      </label>

      <div className="janela-acoes">
        <Button className="botao" onPress={aoCancelar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{textos.comum.salvar}</Button>
      </div>
    </Form>
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
            <Button
              className="botao principal"
              autoFocus
              onPress={() => {
                marcarPasso(rotina.id, passo.id, true);
                avisarMudanca();
                setAtual(atual + 1);
              }}
            >
              {t.proximo} <ArrowRight aria-hidden="true" size="1.1em" />
            </Button>
          </div>
        </div>
      )}
    </Janela>
  );
}
