const form = document.querySelector("#solar-form");

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function formatPayback(value) {
  return value > 0 ? `${value.toFixed(1).replace(".", ",")} anos` : "Acima de 25 anos";
}

function getIrradiacaoSolarPorRegiao(cep) {
  const prefixo = String(cep).replace(/\D/g, "").substring(0, 2);
  const numero = Number(prefixo);

  if (numero >= 80) return 4.5;
  if (numero >= 1 && numero <= 39) return 5.0;
  if (numero >= 70 && numero <= 79) return 5.5;
  if (numero >= 40 && numero <= 65) return 5.8;
  if (numero >= 66 && numero <= 69) return 5.2;

  return 5.2;
}

function getFatorEficienciaTelhado(tipoTelhado) {
  const fatores = {
    metalico: 0.98,
    laje: 0.97,
    fibrocimento: 0.95,
    ceramica: 0.93
  };

  return fatores[tipoTelhado] || 0.95;
}

function getCustoPorKWp(potencia, categoria) {
  let custoBase = 4500;

  if (potencia > 10) custoBase = 4200;
  if (potencia > 20) custoBase = 4000;
  if (potencia > 50) custoBase = 3800;

  if (categoria === "comercial") {
    custoBase *= 1.15;
  }

  return custoBase;
}

function getValorProjecao(projecoes, ano) {
  const ponto = projecoes.find((item) => item.ano === ano);
  return ponto ? ponto.economiaAcumulada : 0;
}

function getViabilidade(payback) {
  if (payback > 0 && payback <= 4) return "Excelente";
  if (payback > 0 && payback <= 6) return "Alta";
  if (payback > 0 && payback <= 8) return "Moderada";
  return "Analise tecnica";
}

function calcularSistemaSolar(dados) {
  const irradiacaoDiaria = getIrradiacaoSolarPorRegiao(dados.cep);
  const irradiacaoMensal = irradiacaoDiaria * 30;
  const eficienciaTelhado = getFatorEficienciaTelhado(dados.tipoTelhado);
  const eficienciaTotal = eficienciaTelhado * 0.97 * 0.92;

  const potenciaNecessaria = dados.consumoKwh / (irradiacaoMensal * eficienciaTotal);
  const potenciaPainel = 0.55;
  const numeroPaineis = Math.ceil(potenciaNecessaria / potenciaPainel);
  const potenciaSistema = numeroPaineis * potenciaPainel;

  const areaNecessaria = Math.ceil(numeroPaineis * 2.3 * 1.3);
  const geracaoMensal = Math.round(potenciaSistema * irradiacaoMensal * eficienciaTotal);
  const investimentoTotal = Math.round(potenciaSistema * getCustoPorKWp(potenciaSistema, dados.categoria));

  const tarifaKwh = dados.valorConta / dados.consumoKwh;
  const custoMinimo = {
    monofasico: 30,
    bifasico: 50,
    trifasico: 100
  }[dados.tipoLigacao] || 30;

  const economiaBruta = (geracaoMensal * tarifaKwh) - custoMinimo;
  const economiaMensal = Math.max(Math.min(economiaBruta, dados.valorConta - custoMinimo), 0);
  const gastoAposInstalacao = Math.max(dados.valorConta - economiaMensal, custoMinimo);
  const reducaoConta = dados.valorConta > 0 ? (economiaMensal / dados.valorConta) * 100 : 0;
  const economiaAnual = Math.round(economiaMensal * 12);

  const projecoes = [];
  let acumulado = 0;
  let retornoInvestimento = 0;

  for (let ano = 1; ano <= 25; ano += 1) {
    const inflacaoEnergetica = Math.pow(1.06, ano - 1);
    const degradacaoPainel = 1 - (0.007 * (ano - 1));
    const economiaAno = economiaAnual * inflacaoEnergetica * degradacaoPainel;

    acumulado += economiaAno;
    projecoes.push({
      ano,
      economiaAnual: Math.round(economiaAno),
      economiaAcumulada: Math.round(acumulado)
    });

    if (acumulado >= investimentoTotal && retornoInvestimento === 0) {
      const acumuladoAnterior = acumulado - economiaAno;
      retornoInvestimento = ano - 1 + ((investimentoTotal - acumuladoAnterior) / economiaAno);
    }
  }

  return {
    consumoKwh: dados.consumoKwh,
    valorConta: dados.valorConta,
    gastoAposInstalacao: Math.round(gastoAposInstalacao),
    reducaoConta,
    potenciaSistema,
    numeroPaineis,
    areaNecessaria,
    geracaoMensal,
    investimentoTotal,
    economiaMensal: Math.round(economiaMensal),
    economiaAnual,
    retornoInvestimento,
    economia5Anos: getValorProjecao(projecoes, 5),
    economia10Anos: getValorProjecao(projecoes, 10),
    economia20Anos: getValorProjecao(projecoes, 20),
    economiaVidaUtil: projecoes[24].economiaAcumulada,
    projecoes,
    dataSimulacao: new Date().toISOString(),
    cliente: dados.cliente
  };
}

function salvarSimulacao(event) {
  event.preventDefault();

  const dados = {
    consumoKwh: Number(form.consumo.value),
    valorConta: Number(form.valor.value),
    cep: form.cep.value,
    categoria: form.categoria.value,
    tipoTelhado: form.telhado.value,
    tipoLigacao: form.ligacao.value,
    cliente: {
      nome: form.nome.value,
      telefone: form.telefone.value,
      cpf: form.cpf.value,
      cidadeEstado: form.cidadeEstado ? form.cidadeEstado.value : ""
    }
  };

  if (!dados.consumoKwh || !dados.valorConta) {
    alert("Preencha consumo e valor da conta para calcular.");
    return;
  }

  const resultado = calcularSistemaSolar(dados);
  localStorage.setItem("resultadoSolar", JSON.stringify(resultado));
  window.location.href = "resultados.html";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function atualizarGrafico(projecoes) {
  const grafico = document.querySelector("#grafico-economia");
  if (!grafico) return;
  if (!projecoes || projecoes.length === 0) {
    grafico.innerHTML = "";
    return;
  }

  const pontos = projecoes.filter((ponto) => [1, 3, 5, 10, 15, 20, 25].includes(ponto.ano));
  const maiorValor = Math.max(...pontos.map((ponto) => ponto.economiaAcumulada));

  grafico.innerHTML = pontos
    .map((ponto) => {
      const altura = Math.max((ponto.economiaAcumulada / maiorValor) * 100, 10);
      return `
        <div class="chart-column" title="Ano ${ponto.ano}: ${formatCurrency(ponto.economiaAcumulada)}">
          <span style="height: ${altura}%"></span>
          <small>${ponto.ano}a</small>
        </div>
      `;
    })
    .join("");
}

function atualizarBarras(resultado) {
  const barraAtual = document.querySelector("#barra-atual");
  const barraSolar = document.querySelector("#barra-solar");
  if (!barraAtual || !barraSolar) return;

  const percentualSolar = resultado.valorConta > 0
    ? Math.max((resultado.gastoAposInstalacao / resultado.valorConta) * 100, 6)
    : 6;

  barraAtual.style.width = "100%";
  barraSolar.style.width = `${percentualSolar}%`;
}

function normalizarResultado(resultado) {
  const economiaMensal = resultado.economiaMensal || Math.round((resultado.economiaAnual || 0) / 12);
  const valorConta = resultado.valorConta || Math.max(economiaMensal, 1);
  const gastoAposInstalacao = resultado.gastoAposInstalacao ?? Math.max(valorConta - economiaMensal, 0);
  const reducaoConta = resultado.reducaoConta ?? ((economiaMensal / valorConta) * 100);
  const projecoes = resultado.projecoes || [];

  return {
    ...resultado,
    consumoKwh: resultado.consumoKwh || 0,
    valorConta,
    gastoAposInstalacao,
    reducaoConta,
    projecoes,
    economiaMensal,
    economia5Anos: resultado.economia5Anos || getValorProjecao(projecoes, 5),
    economia10Anos: resultado.economia10Anos || getValorProjecao(projecoes, 10),
    economia20Anos: resultado.economia20Anos || getValorProjecao(projecoes, 20),
    dataSimulacao: resultado.dataSimulacao || new Date().toISOString()
  };
}

function preencherResultados(resultado) {
  resultado = normalizarResultado(resultado);
  const payback = formatPayback(resultado.retornoInvestimento);
  const potencia = `${resultado.potenciaSistema.toFixed(2).replace(".", ",")} kWp`;
  const geracao = `${formatNumber(resultado.geracaoMensal)} kWh`;
  const data = new Date(resultado.dataSimulacao || Date.now()).toLocaleDateString("pt-BR");
  const nomeCliente = resultado.cliente?.nome || "Nao informado";
  const cidadeCliente = resultado.cliente?.cidadeEstado || "Nao informado";

  setText("#viabilidade-projeto", getViabilidade(resultado.retornoInvestimento));
  setText("#investimento-total", formatCurrency(resultado.investimentoTotal));
  setText("#economia-mensal", formatCurrency(resultado.economiaMensal));
  setText("#economia-anual", formatCurrency(resultado.economiaAnual));
  setText("#retorno-investimento", payback);
  setText("#economia-vida-util", `${formatCurrency(resultado.economiaVidaUtil)} em 25 anos`);
  setText("#reducao-conta", `${formatPercent(resultado.reducaoConta)} de reducao na conta`);
  setText("#potencia-sistema", potencia);
  setText("#numero-paineis", `${resultado.numeroPaineis} unidades`);
  setText("#area-necessaria", `${resultado.areaNecessaria} m²`);
  setText("#geracao-mensal", geracao);
  setText("#gasto-atual", formatCurrency(resultado.valorConta));
  setText("#gasto-pos-instalacao", formatCurrency(resultado.gastoAposInstalacao));
  setText("#economia-5-anos", formatCurrency(resultado.economia5Anos));
  setText("#economia-10-anos", formatCurrency(resultado.economia10Anos));
  setText("#economia-20-anos", formatCurrency(resultado.economia20Anos));
  setText("#cliente-nome", nomeCliente);
  setText("#cliente-cidade", cidadeCliente);
  setText("#consumo-medio", `${formatNumber(resultado.consumoKwh)} kWh/mes`);
  setText("#resumo-potencia", potencia);
  setText("#resumo-investimento", formatCurrency(resultado.investimentoTotal));
  setText("#resumo-retorno", payback);
  setText("#resumo-economia", `${formatCurrency(resultado.economia20Anos)} em 20 anos`);
  setText("#data-simulacao", data);
  setText(
    "#resumo-executivo",
    `${nomeCliente}, a simulacao indica uma economia mensal estimada de ${formatCurrency(resultado.economiaMensal)}, com reducao aproximada de ${formatPercent(resultado.reducaoConta)} na conta e retorno previsto em ${payback}.`
  );

  atualizarBarras(resultado);
  atualizarGrafico(resultado.projecoes);
}

function gerarPdfProposta() {
  const resultadoSalvo = localStorage.getItem("resultadoSolar");
  if (!resultadoSalvo) {
    alert("Nenhuma simulacao encontrada para gerar a proposta.");
    return;
  }

  document.body.classList.add("print-proposal");
  window.print();
  setTimeout(() => document.body.classList.remove("print-proposal"), 500);
}

function mostrarResultados() {
  const resultadoSalvo = localStorage.getItem("resultadoSolar");

  if (!resultadoSalvo) {
    const descricao = document.querySelector("#resultado-descricao");
    if (descricao) {
      descricao.textContent = "Nenhuma simulacao foi encontrada. Volte para a pagina de simulacao e preencha os dados.";
    }
    return;
  }

  preencherResultados(JSON.parse(resultadoSalvo));
}

if (form) {
  form.addEventListener("submit", salvarSimulacao);
}

if (document.querySelector("#resultado")) {
  mostrarResultados();
  document.querySelector("#gerar-pdf")?.addEventListener("click", gerarPdfProposta);
  document.querySelector("#gerar-pdf-footer")?.addEventListener("click", gerarPdfProposta);
}
