/* Acessibilidade: VLibras + painel de leitura (tamanho, fonte, espaçamento, contraste) */
(function () {
  var html = document.documentElement;
  var CHAVE = 'acc-prefs';
  var TAMANHOS = [100, 115, 130, 150];
  var prefs = { tamanho: 0, fonte: false, espaco: false, contraste: false };

  /* As preferências ficam só nesta aba (sessionStorage) e somem ao fechar o navegador */
  try {
    var salvo = JSON.parse(sessionStorage.getItem(CHAVE));
    if (salvo) { prefs = Object.assign(prefs, salvo); }
  } catch (e) {}

  function salvar() {
    try { sessionStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch (e) {}
  }

  function aplicar() {
    html.style.fontSize = TAMANHOS[prefs.tamanho] + '%';
    html.classList.toggle('acc-fonte', prefs.fonte);
    html.classList.toggle('acc-espaco', prefs.espaco);
    html.classList.toggle('acc-contraste', prefs.contraste);
    botoes.fonte.setAttribute('aria-pressed', prefs.fonte);
    botoes.espaco.setAttribute('aria-pressed', prefs.espaco);
    botoes.contraste.setAttribute('aria-pressed', prefs.contraste);
    salvar();
  }

  /* Monta o botão e o painel */
  var abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.className = 'acc-botao';
  abrir.setAttribute('aria-expanded', 'false');
  abrir.setAttribute('aria-controls', 'acc-painel');
  abrir.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M5 9h14M12 9v6m0 0l-3 6m3-6l3 6"/></svg><span>Acessibilidade</span>';

  var painel = document.createElement('div');
  painel.id = 'acc-painel';
  painel.className = 'acc-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Opções de acessibilidade');
  painel.hidden = true;

  var titulo = document.createElement('h2');
  titulo.textContent = 'Facilitar a leitura';
  painel.appendChild(titulo);

  function botao(texto, classe) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = classe || 'acc-opcao';
    b.textContent = texto;
    return b;
  }

  var linhaTamanho = document.createElement('div');
  linhaTamanho.className = 'acc-linha';
  var menos = botao('A−');
  var mais = botao('A+');
  menos.setAttribute('aria-label', 'Diminuir o tamanho das letras');
  mais.setAttribute('aria-label', 'Aumentar o tamanho das letras');
  linhaTamanho.appendChild(menos);
  linhaTamanho.appendChild(mais);
  painel.appendChild(linhaTamanho);

  var botoes = {
    fonte: botao('Fonte de leitura fácil'),
    espaco: botao('Mais espaço entre letras e linhas'),
    contraste: botao('Alto contraste')
  };
  Object.keys(botoes).forEach(function (k) {
    var linha = document.createElement('div');
    linha.className = 'acc-linha';
    linha.appendChild(botoes[k]);
    painel.appendChild(linha);
  });

  var restaurar = botao('Restaurar o padrão', 'acc-opcao acc-reset');
  painel.appendChild(restaurar);

  var dica = document.createElement('p');
  dica.className = 'acc-dica';
  dica.textContent = 'Para Libras, use o botão azul das mãos, na lateral da tela.';
  painel.appendChild(dica);

  document.body.appendChild(abrir);
  document.body.appendChild(painel);

  function fechar() {
    painel.hidden = true;
    abrir.setAttribute('aria-expanded', 'false');
  }

  abrir.addEventListener('click', function (e) {
    e.stopPropagation();
    var abriu = painel.hidden;
    painel.hidden = !abriu;
    abrir.setAttribute('aria-expanded', abriu);
    if (abriu) { menos.focus(); }
  });
  painel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', fechar);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !painel.hidden) { fechar(); abrir.focus(); }
  });

  menos.addEventListener('click', function () { prefs.tamanho = Math.max(0, prefs.tamanho - 1); aplicar(); });
  mais.addEventListener('click', function () { prefs.tamanho = Math.min(TAMANHOS.length - 1, prefs.tamanho + 1); aplicar(); });
  botoes.fonte.addEventListener('click', function () { prefs.fonte = !prefs.fonte; aplicar(); });
  botoes.espaco.addEventListener('click', function () { prefs.espaco = !prefs.espaco; aplicar(); });
  botoes.contraste.addEventListener('click', function () { prefs.contraste = !prefs.contraste; aplicar(); });
  restaurar.addEventListener('click', function () {
    prefs = { tamanho: 0, fonte: false, espaco: false, contraste: false };
    aplicar();
  });

  aplicar();

  /* VLibras (tradutor para Libras do governo federal) */
  var vw = document.createElement('div');
  vw.setAttribute('vw', '');
  vw.className = 'enabled';
  vw.innerHTML =
    '<div vw-access-button class="active"></div>' +
    '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
  document.body.appendChild(vw);

  var script = document.createElement('script');
  script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
  script.onload = function () {
    if (window.VLibras) { new window.VLibras.Widget('https://vlibras.gov.br/app'); }
  };
  document.body.appendChild(script);
})();