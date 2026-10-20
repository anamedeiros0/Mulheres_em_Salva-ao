<?php
/*
 * api.php — recebe os formulários do site (mensagem, voluntária, newsletter).
 *
 * Para ver o erro real do servidor durante testes, coloque no config.php:
 *     define('DEBUG_API', true);
 * Depois dos testes, remova essa linha (ou troque para false).
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function responder($codigo, $erro = null) {
    http_response_code($codigo);
    echo json_encode($erro === null ? ['ok' => true] : ['ok' => false, 'erro' => $erro]);
    exit;
}

/* Qualquer erro fatal vira uma resposta JSON, em vez de uma tela em branco */
set_exception_handler(function ($e) {
    error_log('api.php: ' . $e->getMessage());
    $detalhe = (defined('DEBUG_API') && DEBUG_API) ? $e->getMessage() : 'servidor';
    responder(500, $detalhe);
});

$arquivoConfig = __DIR__ . '/config.php';
if (!is_file($arquivoConfig)) {
    error_log('api.php: config.php não encontrado em ' . __DIR__);
    responder(500, 'config');
}
require $arquivoConfig;

foreach (['DB_HOST', 'DB_NOME', 'DB_USUARIO', 'DB_SENHA'] as $constante) {
    if (!defined($constante)) {
        error_log('api.php: falta definir ' . $constante . ' no config.php');
        responder(500, 'config');
    }
}

function texto($dados, $campo, $max) {
    $valor = (isset($dados[$campo]) && is_string($dados[$campo])) ? trim($dados[$campo]) : '';
    return mb_substr($valor, 0, $max, 'UTF-8');
}

function ouNulo($valor) {
    return $valor === '' ? null : $valor;
}

/* Limite de envios por pessoa. Guarda só um código embaralhado do IP, nunca o IP em si. */
function limiteExcedido($maximo, $janelaSegundos) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $pasta = sys_get_temp_dir();
    $arquivo = $pasta . DIRECTORY_SEPARATOR . 'mes_limite_' . hash('sha256', $ip . '|' . DB_SENHA);
    $agora = time();
    $tempos = [];
    if (is_file($arquivo)) {
        foreach (explode("\n", trim((string) @file_get_contents($arquivo))) as $t) {
            if ((int) $t > $agora - $janelaSegundos) {
                $tempos[] = (int) $t;
            }
        }
    }
    if (count($tempos) >= $maximo) {
        return true;
    }
    $tempos[] = $agora;
    @file_put_contents($arquivo, implode("\n", $tempos), LOCK_EX);

    /* de vez em quando, apaga os registros antigos */
    if (mt_rand(1, 50) === 1) {
        foreach (glob($pasta . DIRECTORY_SEPARATOR . 'mes_limite_*') ?: [] as $f) {
            if (@filemtime($f) < $agora - $janelaSegundos) {
                @unlink($f);
            }
        }
    }
    return false;
}

/* Cria as tabelas se ainda não existirem (precisa de permissão CREATE no banco) */
function garantirTabelas($pdo) {
    $pdo->exec('CREATE TABLE IF NOT EXISTS mensagens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mensagem TEXT NOT NULL,
        apelido VARCHAR(80) NULL,
        canal VARCHAR(20) NOT NULL,
        contato VARCHAR(150) NULL,
        horario VARCHAR(10) NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS voluntarias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(120) NOT NULL,
        email VARCHAR(150) NOT NULL,
        telefone VARCHAR(30) NULL,
        area VARCHAR(40) NOT NULL,
        registro VARCHAR(60) NULL,
        cidade VARCHAR(120) NOT NULL,
        tempo VARCHAR(40) NULL,
        mensagem TEXT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS newsletter (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(150) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY email_unico (email)
    ) CHARACTER SET utf8mb4');
}

if (defined('ORIGEM_PERMITIDA') && ORIGEM_PERMITIDA !== '') {
    header('Access-Control-Allow-Origin: ' . ORIGEM_PERMITIDA);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, 'metodo');
}

/* Só aceita envios vindos do próprio site (ou do endereço liberado no config.php) */
$origem = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origem !== '') {
    $porta = parse_url($origem, PHP_URL_PORT);
    $enderecoOrigem = parse_url($origem, PHP_URL_HOST) . ($porta ? ':' . $porta : '');
    $meuEndereco = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $liberada = defined('ORIGEM_PERMITIDA') && ORIGEM_PERMITIDA !== '' && $origem === ORIGEM_PERMITIDA;
    if ($enderecoOrigem !== $meuEndereco && !$liberada) {
        responder(403, 'origem');
    }
}

/* No máximo 10 envios a cada 10 minutos por pessoa */
if (limiteExcedido(10, 600)) {
    responder(429, 'muitos');
}

$d = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($d)) {
    responder(400, 'dados');
}

$tipo = isset($_GET['tipo']) ? $_GET['tipo'] : '';

/* Valida tudo ANTES de abrir o banco */
$sql = '';
$valores = [];

if ($tipo === 'mensagem') {
    $mensagem = texto($d, 'mensagem', 5000);
    $apelido  = texto($d, 'apelido', 80);
    $canal    = texto($d, 'canal', 20);
    $contato  = texto($d, 'contato', 150);
    $horario  = texto($d, 'horario', 10);

    if ($mensagem === '') { responder(400, 'mensagem'); }
    if (!in_array($canal, ['whatsapp', 'telefone', 'email', 'site'], true)) { responder(400, 'canal'); }
    if ($canal !== 'site' && $contato === '') { responder(400, 'contato'); }
    if (!in_array($horario, ['', 'manha', 'tarde', 'noite'], true)) { responder(400, 'horario'); }
    if (empty($d['aceite'])) { responder(400, 'aceite'); }
    if ($canal === 'site') { $contato = ''; }

    $sql = 'INSERT INTO mensagens (mensagem, apelido, canal, contato, horario) VALUES (?, ?, ?, ?, ?)';
    $valores = [$mensagem, ouNulo($apelido), $canal, ouNulo($contato), ouNulo($horario)];

} elseif ($tipo === 'voluntaria') {
    $nome     = texto($d, 'nome', 120);
    $email    = texto($d, 'email', 150);
    $telefone = texto($d, 'tel', 30);
    $area     = texto($d, 'area', 40);
    $registro = texto($d, 'registro', 60);
    $cidade   = texto($d, 'cidade', 120);
    $tempo    = texto($d, 'tempo', 40);
    $msg      = texto($d, 'msg', 3000);

    if ($nome === '') { responder(400, 'nome'); }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { responder(400, 'email'); }
    if (!in_array($area, ['Psicóloga', 'Advogada', 'Assistente social', 'Outra área'], true)) { responder(400, 'area'); }
    if ($cidade === '') { responder(400, 'cidade'); }
    if (!in_array($tempo, ['', 'Algumas horas por mês', 'Algumas horas por semana', 'Plantões', 'A combinar'], true)) { responder(400, 'tempo'); }
    if (empty($d['aceite'])) { responder(400, 'aceite'); }

    $sql = 'INSERT INTO voluntarias (nome, email, telefone, area, registro, cidade, tempo, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    $valores = [$nome, $email, ouNulo($telefone), $area, ouNulo($registro), $cidade, ouNulo($tempo), ouNulo($msg)];

} elseif ($tipo === 'newsletter') {
    $email = texto($d, 'email', 150);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { responder(400, 'email'); }

    $sql = 'INSERT IGNORE INTO newsletter (email) VALUES (?)';
    $valores = [$email];

} else {
    responder(400, 'tipo');
}

$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';dbname=' . DB_NOME . ';charset=utf8mb4',
    DB_USUARIO,
    DB_SENHA,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
);

try {
    garantirTabelas($pdo);
} catch (Throwable $e) {
    /* Sem permissão para criar tabelas: segue em frente, a tabela pode já existir */
    error_log('api.php (criar tabelas): ' . $e->getMessage());
}

$pdo->prepare($sql)->execute($valores);

responder(200);