// ============================================================
//  danfe.js — DANFE Preview + Exportação (XML, IMG, Print)
//
//  Responsabilidade: renderizar preview do DANFE, gerar XML
//  NF-e conforme padrão SEFAZ 4.00, exportar como imagem.
//  Dependências: state.js, helpers.js, html2canvas (CDN)
// ============================================================

// ── Gerar DANFE (botão principal) ─────────────────────────────

function generateAndExport() {
  renderDANFE();
  toast('Invoice gerada! Exporte nos botões XML, JPEG ou PDF.', 'ok');
}

// ── DANFE Preview ────────────────────────────────────────────

function renderDANFE() {
  const total    = items.reduce((s, it) => s + it.qtd * it.unit, 0);
  const chave    = fmtChave(g('nfChave'));
  const dEmis    = fmtDate(g('nfDataEmis'));
  const dSaida   = fmtDate(g('nfDataSaida'));
  const tipo     = g('nfTipo') === '1' ? '1 — Saída' : '0 — Entrada';

  const rowsHtml = items.map(it =>
    `<tr>
      <td>${it.barcode || ''}</td>
      <td class="tl">${it.desc}</td>
      <td>${it.ncm || ''}</td>
      <td>${it.cfop}</td>
      <td>${it.un}</td>
      <td>${fmtN(it.qtd)}</td>
      <td>R$ ${fmtN(it.unit)}</td>
      <td>R$ ${fmtN(it.qtd * it.unit)}</td>
      <td>0,00</td>
      <td>0,00</td>
      <td>0,00</td>
    </tr>`
  ).join('');

  const preview = document.getElementById('danfePreview');
  if (!preview) return;

  preview.innerHTML = `
    <div class="d-border d-g3r">
      <div class="d-cell">
        <div style="font-weight:bold;font-size:10px">${g('emRazao')}</div>
        <div>${g('emEnd')}</div>
        <div>CEP: ${g('emCep')} — ${g('emMun')} — ${g('emUf')}</div>
        <div>Fone: ${g('emFone')}</div>
        <div style="font-size:7px">${g('emEmail')}</div>
      </div>
      <div class="d-cell" style="text-align:center">
        <div style="font-weight:bold;font-size:11px">DANFE</div>
        <div style="font-size:7px">Documento Auxiliar<br>da Nota Fiscal<br>Eletrônica</div>
        <div style="margin:4px 0;border:1px solid #000;padding:2px;font-size:7px">${tipo}</div>
        <div style="font-weight:bold;font-size:9px">Nº ${g('nfNum')}</div>
        <div style="font-size:7px">SERIE: ${g('nfSerie')}</div>
      </div>
      <div class="d-cell" style="text-align:right">
        <div style="font-size:8px;font-weight:bold">NF-e</div>
        <div style="font-size:10px;font-weight:bold">Nº ${g('nfNum')}</div>
      </div>
    </div>
    <div class="d-section" style="padding:4px 5px;margin-bottom:3px">
      <span class="d-lbl">Chave de acesso</span>
      <div class="d-chave">${chave}</div>
    </div>
    <div class="d-section">
      <div class="d-g2">
        <div class="d-cell"><span class="d-lbl">Natureza da operação</span><div class="d-val">${g('nfNat')}</div></div>
        <div class="d-cell"><span class="d-lbl">Protocolo</span><div class="d-val">${g('nfProtocolo')} ${dEmis}</div></div>
      </div>
      <div class="d-g3 d-row-bt">
        <div class="d-cell"><span class="d-lbl">Inscrição Estadual</span><div class="d-val">${g('emIe')}</div></div>
        <div class="d-cell"><span class="d-lbl">Insc. Est. Subst.</span><div class="d-val">—</div></div>
        <div class="d-cell"><span class="d-lbl">CNPJ</span><div class="d-val">${g('emCnpj')}</div></div>
      </div>
    </div>
    <div class="d-section">
      <div class="d-shdr">Destinatário / Remetente</div>
      <div class="d-g2111">
        <div class="d-cell"><span class="d-lbl">Nome</span><div class="d-val">${g('destNome')}</div></div>
        <div class="d-cell"><span class="d-lbl">CNPJ/CPF</span><div class="d-val">${g('destCnpj')}</div></div>
        <div class="d-cell"><span class="d-lbl">Insc. Estadual</span><div class="d-val">${g('destIe')}</div></div>
        <div class="d-cell">
          <span class="d-lbl">Data emissão</span><div class="d-val">${dEmis}</div>
          <span class="d-lbl">Data saída</span><div class="d-val">${dSaida}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr" class="d-row-bt">
        <div class="d-cell"><span class="d-lbl">Endereço</span><div class="d-val">${g('destEnd')}</div></div>
        <div class="d-cell"><span class="d-lbl">Bairro</span><div class="d-val">${g('destBairro')}</div></div>
        <div class="d-cell"><span class="d-lbl">CEP</span><div class="d-val">${g('destCep')}</div></div>
        <div class="d-cell"><span class="d-lbl">Município/UF</span><div class="d-val">${g('destMun')} ${g('destUf')}</div></div>
      </div>
    </div>
    <div class="d-section">
      <div class="d-shdr">Cálculo do Imposto</div>
      <div class="d-g4">
        <div class="d-cell"><span class="d-lbl">Base Cálculo ICMS</span><div class="d-val">R$ ${g('bcIcms')}</div></div>
        <div class="d-cell"><span class="d-lbl">Valor ICMS</span><div class="d-val">R$ ${g('vlrIcms')}</div></div>
        <div class="d-cell"><span class="d-lbl">Total produtos</span><div class="d-val">R$ ${fmtN(total)}</div></div>
        <div class="d-cell"><span class="d-lbl">Total nota</span><div style="font-size:10px;font-weight:bold">R$ ${fmtN(total)}</div></div>
      </div>
    </div>
    <div class="d-section">
      <div class="d-shdr">Itens da Nota Fiscal</div>
      <table class="d-table">
        <thead><tr>
          <th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>UN</th>
          <th>Qtde</th><th>Preço unit.</th><th>Preço total</th>
          <th>BC ICMS</th><th>Vlr.ICMS</th><th>Vlr.IPI</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div class="d-section">
      <div class="d-shdr">Dados Adicionais</div>
      <div class="d-g2">
        <div class="d-cell"><span class="d-lbl">Observações</span><div style="font-size:7.5px;white-space:pre-wrap;margin-top:2px">${g('obsNf')}</div></div>
        <div class="d-cell"><span class="d-lbl">Reservado ao fisco</span></div>
      </div>
    </div>`;
}

// ── Exportar XML NF-e ────────────────────────────────────────

function exportXML() {
  const total = items.reduce((s, it) => s + it.qtd * it.unit, 0);
  const chave = g('nfChave').replace(/\D/g, '');
  const nNF   = g('nfNum').replace(/\D/g, '');
  const cNF   = g('nfCNF') || nNF.slice(0, 8);
  const serie = g('nfSerie') || '1';
  const dEmis = g('nfDataEmis');
  const dSai  = g('nfDataSaida') || dEmis;
  const hora  = '10:00:00-03:00';

  // Campos padrão da NF
  const nfParams = _readNFFormParams();

  // Gera XML de cada item
  const itensXml = items.map((it, i) => _buildItemXml(it, i, nNF, dEmis, nfParams)).join('');

  const gv = id => (g(id) || '0').replace(',', '.');

  const xml = _buildFullXml({
    chave, nNF, cNF, serie, dEmis, dSai, hora, total,
    itensXml, nfParams, gv,
  });

  download(`${chave || ('NF-' + nNF + '-serie' + serie)}.xml`, xml, 'application/xml');
  toast('XML exportado!', 'ok');
}

// ── Exportar imagem ──────────────────────────────────────────

async function exportIMG() {
  renderDANFE();
  toast('Gerando imagem…');

  try {
    const canvas = await html2canvas(document.getElementById('danfeWrapper'), {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });
    const a = document.createElement('a');
    a.href     = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `NF-${g('nfNum').replace(/\D/g, '')}.jpg`;
    a.click();
    toast('JPEG exportado!', 'ok');
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Imprimir ─────────────────────────────────────────────────

function printDANFE() {
  renderDANFE();
  window.print();
}

// ── Helpers internos ─────────────────────────────────────────

function _readNFFormParams() {
  return {
    cUF:          g('nfCUF') || '35',
    cMunFG:       g('nfCMunFG') || '3550308',
    tpAmb:        g('nfTpAmb') || '2',
    idDest:       g('nfIdDest') || '1',
    indFinal:     g('nfIndFinal') || '0',
    indIntermed:  g('nfIndIntermed') || '0',
    verProc:      g('nfVerProc') || 'GRCNFE1.0',
    crt:          g('emCrt') || '3',
    icmsOrig:     g('icmsOrig') || '2',
    icmsCst:      g('icmsCst') || '10',
    icmsModBC:    g('icmsModBC') || '3',
    pICMS:        g('icmsPicms') || '4.0000',
    icmsModBCST:  g('icmsModBCST') || '4',
    pMVAST:       g('icmsPmvast') || '65.5400',
    pRedBCST:     g('icmsPredBCST') || '0.0000',
    pICMSST:      g('icmsPicmsST') || '18.0000',
    pFCPST:       g('icmsPfcpST') || '2.0000',
    ncmDefault:   g('icmsNcm') || '18063210',
    cestDefault:  g('icmsCest') || '1700300',
    indEscala:    g('icmsIndEscala') || 'S',
    ipiCenq:      g('ipiCenq') || '999',
    ipiCst:       g('ipiCst') || '53',
    pisCst:       g('pisCst') || '01',
    pPIS:         g('pisPpis') || '1.6500',
    cofinsCst:    g('cofinsCst') || '01',
    pCOFINS:      g('cofinsPcofins') || '7.6000',
  };
}

function _buildItemXml(it, i, nNF, dEmis, p) {
  const vProd       = (it.qtd * it.unit).toFixed(2);
  const vBC         = vProd;
  const vICMS       = (parseFloat(vBC) * parseFloat(p.pICMS) / 100).toFixed(2);
  const vBCST       = (parseFloat(vBC) * (1 + parseFloat(p.pMVAST) / 100)).toFixed(2);
  const vICMSST     = (parseFloat(vBCST) * parseFloat(p.pICMSST) / 100 - parseFloat(vICMS)).toFixed(2);
  const vBCFCPST    = vBCST;
  const vFCPST      = (parseFloat(vBCFCPST) * parseFloat(p.pFCPST) / 100).toFixed(2);
  const vPIS        = (parseFloat(vBC) * parseFloat(p.pPIS) / 100).toFixed(2);
  const vCOFINS     = (parseFloat(vBC) * parseFloat(p.pCOFINS) / 100).toFixed(2);
  const ncm         = it.ncm || p.ncmDefault;
  const barcode     = it.barcode || '';
  const dFab        = dEmis;
  const dVal        = (() => {
    const d = new Date(dEmis);
    d.setFullYear(d.getFullYear() + 1);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  })();

  return `<det nItem="${i + 1}"><prod>`
    + `<cProd>${xmlEsc(barcode)}</cProd>`
    + `<cEAN>${xmlEsc(barcode)}</cEAN>`
    + `<xProd>${xmlEsc(it.desc)}</xProd>`
    + `<NCM>${xmlEsc(ncm)}</NCM>`
    + `<CEST>${xmlEsc(p.cestDefault)}</CEST>`
    + `<indEscala>${xmlEsc(p.indEscala)}</indEscala>`
    + `<CFOP>${xmlEsc((it.cfop || '6403').replace('.', ''))}</CFOP>`
    + `<uCom>${xmlEsc(it.un || 'PAC')}</uCom>`
    + `<qCom>${it.qtd.toFixed(4)}</qCom>`
    + `<vUnCom>${it.unit.toFixed(2)}</vUnCom>`
    + `<vProd>${vProd}</vProd>`
    + `<cEANTrib>${xmlEsc(barcode)}</cEANTrib>`
    + `<uTrib>UN</uTrib>`
    + `<qTrib>${it.qtd.toFixed(4)}</qTrib>`
    + `<vUnTrib>${it.unit.toFixed(2)}</vUnTrib>`
    + `<vFrete>0.00</vFrete><vDesc>0.00</vDesc><vOutro>0.00</vOutro>`
    + `<indTot>1</indTot>`
    + `<xPed>${xmlEsc(nNF.slice(0, 7))}</xPed>`
    + `<nItemPed>${i + 1}</nItemPed>`
    + `<rastro><nLote>LOTE1</nLote><qLote>${it.qtd.toFixed(3)}</qLote><dFab>${dFab}</dFab><dVal>${dVal}</dVal></rastro>`
    + `</prod><imposto>`
    + `<ICMS10><orig>${p.icmsOrig}</orig><CST>${p.icmsCst}</CST><modBC>${p.icmsModBC}</modBC><vBC>${vBC}</vBC><pICMS>${p.pICMS}</pICMS><vICMS>${vICMS}</vICMS><modBCST>${p.icmsModBCST}</modBCST><pMVAST>${p.pMVAST}</pMVAST><pRedBCST>${p.pRedBCST}</pRedBCST><vBCST>${vBCST}</vBCST><pICMSST>${p.pICMSST}</pICMSST><vICMSST>${vICMSST}</vICMSST><vBCFCPST>${vBCFCPST}</vBCFCPST><pFCPST>${p.pFCPST}</pFCPST><vFCPST>${vFCPST}</vFCPST></ICMS10>`
    + `<IPI><cEnq>${p.ipiCenq}</cEnq><IPINT><CST>${p.ipiCst}</CST></IPINT></IPI>`
    + `<PIS><PISAliq><CST>${p.pisCst}</CST><vBC>${vBC}</vBC><pPIS>${p.pPIS}</pPIS><vPIS>${vPIS}</vPIS></PISAliq></PIS>`
    + `<COFINS><COFINSAliq><CST>${p.cofinsCst}</CST><vBC>${vBC}</vBC><pCOFINS>${p.pCOFINS}</pCOFINS><vCOFINS>${vCOFINS}</vCOFINS></COFINSAliq></COFINS>`
    + `</imposto>`
    + `<infAdProd>DATA FAB.: ${dFab} DATA VAL.: ${dVal}</infAdProd>`
    + `</det>`;
}

function _buildFullXml({ chave, nNF, cNF, serie, dEmis, dSai, hora, total, itensXml, nfParams: p, gv }) {
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">`
    + `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`
    + `<infNFe versao="4.00" Id="NFe${chave}">`
    + `<ide><cUF>${p.cUF}</cUF><cNF>${cNF}</cNF><natOp>${xmlEsc(g('nfNat'))}</natOp><mod>55</mod><serie>${serie}</serie><nNF>${nNF}</nNF><dhEmi>${dEmis}T${hora}</dhEmi><dhSaiEnt>${dSai}T${hora}</dhSaiEnt><tpNF>${g('nfTipo')}</tpNF><idDest>${p.idDest}</idDest><cMunFG>${p.cMunFG}</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>7</cDV><tpAmb>${p.tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>${p.indFinal}</indFinal><indPres>9</indPres><indIntermed>${p.indIntermed}</indIntermed><procEmi>0</procEmi><verProc>${xmlEsc(p.verProc)}</verProc></ide>`
    + `<emit><CNPJ>${g('emCnpj').replace(/\D/g, '')}</CNPJ><xNome>${xmlEsc(g('emRazao'))}</xNome><enderEmit><xLgr>${xmlEsc(g('emEnd'))}</xLgr><nro>${xmlEsc(g('emNro') || 'S/N')}</nro><xBairro>${xmlEsc(g('emBairro') || 'Centro')}</xBairro><cMun>${g('emCMun') || p.cMunFG}</cMun><xMun>${xmlEsc(g('emMun'))}</xMun><UF>${xmlEsc(g('emUf'))}</UF><CEP>${g('emCep').replace(/\D/g, '')}</CEP><cPais>1058</cPais><xPais>Brasil</xPais><fone>${g('emFone').replace(/\D/g, '')}</fone></enderEmit><IE>${g('emIe').replace(/\D/g, '')}</IE><CRT>${p.crt}</CRT></emit>`
    + `<dest><CNPJ>${g('destCnpj').replace(/\D/g, '')}</CNPJ><xNome>${xmlEsc(g('destNome'))}</xNome><enderDest><xLgr>${xmlEsc(g('destEnd'))}</xLgr><nro>${xmlEsc(g('destNro') || 'S/N')}</nro><xBairro>${xmlEsc(g('destBairro'))}</xBairro><cMun>${g('destCMun') || '3505708'}</cMun><xMun>${xmlEsc(g('destMun'))}</xMun><UF>${xmlEsc(g('destUf'))}</UF><CEP>${g('destCep').replace(/\D/g, '')}</CEP><cPais>1058</cPais><xPais>Brasil</xPais><fone>${(g('destFone') || '').replace(/\D/g, '')}</fone></enderDest><indIEDest>${g('destIndIEDest') || '1'}</indIEDest><IE>${g('destIe').replace(/\D/g, '')}</IE></dest>`
    + itensXml
    + `<total><ICMSTot><vBC>${gv('bcIcms')}</vBC><vICMS>${gv('vlrIcms')}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>${gv('bcIcmsSt')}</vBCST><vST>${gv('vlrIcmsSt')}</vST><vFCPST>${gv('vlrFcp')}</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${total.toFixed(2)}</vProd><vFrete>${gv('vlrFrete')}</vFrete><vSeg>${gv('vlrSeg')}</vSeg><vDesc>${gv('vlrDesc')}</vDesc><vII>0.00</vII><vIPI>${gv('vlrIpi')}</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>${gv('vlrOutras')}</vOutro><vNF>${total.toFixed(2)}</vNF></ICMSTot></total>`
    + `<transp><modFrete>${g('transpModFrete') || '0'}</modFrete><transporta><CNPJ>${(g('transpCnpj') || '').replace(/\D/g, '')}</CNPJ><xNome>${xmlEsc(g('transpNome'))}</xNome><IE>${(g('transpIe') || '').replace(/\D/g, '')}</IE><xEnder>${xmlEsc(g('transpEnd'))}</xEnder><xMun>${xmlEsc(g('transpMun'))}</xMun><UF>${xmlEsc(g('transpUf'))}</UF></transporta><vol><qVol>${g('volQvol') || '1'}</qVol><esp>${xmlEsc(g('volEsp') || 'PACOTE')}</esp><pesoL>${g('volPesoL') || '0.000'}</pesoL><pesoB>${g('volPesoB') || '0.000'}</pesoB></vol></transp>`
    + `<cobr><fat><nFat>${xmlEsc(g('fatNum'))}</nFat><vOrig>${gv('fatVOrig')}</vOrig><vDesc>${gv('fatVDesc')}</vDesc><vLiq>${gv('fatVLiq')}</vLiq></fat><dup><nDup>${xmlEsc(g('dupNum') || '001')}</nDup><dVenc>${g('dupVenc') || dSai}</dVenc><vDup>${gv('dupVal')}</vDup></dup></cobr>`
    + `<pag><detPag><tPag>${g('pagTipo') || '15'}</tPag><vPag>${gv('pagVal')}</vPag></detPag></pag>`
    + `<infAdic>${g('infAdFisco') ? '<infAdFisco>' + xmlEsc(g('infAdFisco')) + '</infAdFisco>' : ''}<infCpl>${xmlEsc(g('obsNf'))}</infCpl></infAdic>`
    + `</infNFe></NFe>`
    + `<protNFe versao="4.00"><infProt><tpAmb>${p.tpAmb}</tpAmb><verAplic>SP_NFE_PL009_V4</verAplic><chNFe>${chave}</chNFe><dhRecbto>${dEmis}T${hora}</dhRecbto><nProt>${g('nfProtocolo')}</nProt><digVal>+ayODYlT9JiaNGRW1H28R6lcHDI=</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>`
    + `</nfeProc>`;
}
