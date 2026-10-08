/* Menus suspensos + chat de ajuda rápida (IA) */
(function () {

  /* ===== CONFIGURAÇÃO ===== */
  /* Endereço do servidor do chat (pasta "servidor"). Ex.: 'https://chat.seudominio.com.br'.
     Deixe vazio se o servidor estiver no mesmo domínio do site. */
  var CHAT_API = '';
  /* Número do WhatsApp da rede, só com números, com 55 e DDD. Ex.: '5511999999999'.
     Deixe vazio para esconder o botão do WhatsApp. */
  var NUMERO_WHATSAPP = '';

  /* ===== MENUS SUSPENSOS ===== */
  var menus = document.querySelectorAll('.menu-suspenso');

  function fecharMenus(exceto) {
    menus.forEach(function (m) {
      if (m !== exceto) {
        m.classList.remove('aberto');
        m.querySelector('.menu-botao').setAttribute('aria-expanded', 'false');
      }
    });
  }

  menus.forEach(function (menu) {
    var botao = menu.querySelector('.menu-botao');
    botao.addEventListener('click', function (e) {
      e.stopPropagation();
      fecharMenus(menu);
      var aberto = menu.classList.toggle('aberto');
      botao.setAttribute('aria-expanded', aberto);
    });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { fecharMenus(); botao.focus(); }
    });
  });
  document.addEventListener('click', function () { fecharMenus(); });

  /* ===== CHAT DE AJUDA RÁPIDA ===== */
  var historico = [];
  var ocupado = false;

  var abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.className = 'chat-botao';
  abrir.setAttribute('aria-expanded', 'false');
  abrir.setAttribute('aria-controls', 'chat-painel');
  abrir.textContent = 'Ajuda rápida';

  var painel = document.createElement('div');
  painel.id = 'chat-painel';
  painel.className = 'chat-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Chat de ajuda rápida');
  painel.hidden = true;

  var cab = document.createElement('div');
  cab.className = 'chat-cab';
  var tit = document.createElement('strong');
  tit.textContent = 'Ajuda rápida';
  var fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'chat-fechar';
  fechar.setAttribute('aria-label', 'Fechar o chat');
  fechar.textContent = '×';
  cab.appendChild(tit);
  cab.appendChild(fechar);

  var aviso = document.createElement('p');
  aviso.className = 'chat-aviso';
  aviso.textContent = 'Você está falando com uma assistente virtual (inteligência artificial), não com uma pessoa. Em perigo agora, ligue 190. Para orientação, ligue 180.';

  var lista = document.createElement('div');
  lista.className = 'chat-msgs';
  lista.setAttribute('role', 'log');
  lista.setAttribute('aria-live', 'polite');

  var form = document.createElement('form');
  form.className = 'chat-form';
  var campo = document.createElement('input');
  campo.type = 'text';
  campo.maxLength = 1000;
  campo.autocomplete = 'off';
  campo.placeholder = 'Escreva aqui';
  campo.setAttribute('aria-label', 'Sua mensagem');
  var enviar = document.createElement('button');
  enviar.type = 'submit';
  enviar.textContent = 'Enviar';
  form.appendChild(campo);
  form.appendChild(enviar);

  var rodape = document.createElement('div');
  rodape.className = 'chat-rodape';
  var pessoa = document.createElement('a');
  pessoa.href = 'fale-com-a-rede.html';
  pessoa.textContent = 'Falar com uma pessoa';
  rodape.appendChild(pessoa);
  if (NUMERO_WHATSAPP) {
    var wa = document.createElement('a');
    wa.href = 'https://wa.me/' + NUMERO_WHATSAPP + '?text=' + encodeURIComponent('Oi, preciso de ajuda.');
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.textContent = 'Continuar no WhatsApp';
    rodape.appendChild(wa);
    var nota = document.createElement('p');
    nota.className = 'chat-nota';
    nota.textContent = 'No WhatsApp a conversa fica no seu celular. Se alguém olha seu aparelho, apague depois.';
    rodape.appendChild(nota);
  }

  painel.appendChild(cab);
  painel.appendChild(aviso);
  painel.appendChild(lista);
  painel.appendChild(form);
  painel.appendChild(rodape);
  document.body.appendChild(abrir);
  document.body.appendChild(painel);

  function mensagem(texto, quem) {
    var d = document.createElement('div');
    d.className = 'chat-msg ' + quem;
    d.textContent = texto;
    lista.appendChild(d);
    lista.scrollTop = lista.scrollHeight;
    return d;
  }

  mensagem('Oi! Posso explicar como funciona o acolhimento e indicar serviços. Como posso ajudar?', 'ia');

  function abrirChat() {
    painel.hidden = false;
    abrir.setAttribute('aria-expanded', 'true');
    campo.focus();
  }
  function fecharChat() {
    painel.hidden = true;
    abrir.setAttribute('aria-expanded', 'false');
  }

  abrir.addEventListener('click', function (e) {
    e.stopPropagation();
    if (painel.hidden) { abrirChat(); } else { fecharChat(); }
  });
  fechar.addEventListener('click', function () { fecharChat(); abrir.focus(); });
  painel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !painel.hidden) { fecharChat(); abrir.focus(); }
  });

  /* Links "Chat" do menu abrem o painel em vez de mudar de página */
  document.querySelectorAll('[data-abrir-chat]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fecharMenus(); abrirChat(); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var texto = campo.value.trim();
    if (!texto || ocupado) { return; }
    campo.value = '';
    mensagem(texto, 'eu');
    historico.push({ role: 'user', content: texto });
    ocupado = true;
    enviar.disabled = true;
    var espera = mensagem('Digitando…', 'ia');

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 120000);

    fetch(CHAT_API + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagens: historico.slice(-12) }),
      signal: ctrl.signal
    })
      .then(function (r) { if (!r.ok) { throw new Error('erro'); } return r.json(); })
      .then(function (d) {
        espera.textContent = d.resposta;
        historico.push({ role: 'assistant', content: d.resposta });
      })
      .catch(function () {
        historico.pop();
        espera.textContent = 'Não consegui responder agora. Se precisar de ajuda, ligue 180 (orientação) ou 190 (perigo agora), ou escreva para a nossa rede.';
      })
      .finally(function () {
        clearTimeout(timer);
        ocupado = false;
        enviar.disabled = false;
        lista.scrollTop = lista.scrollHeight;
        campo.focus();
      });
  });
})();