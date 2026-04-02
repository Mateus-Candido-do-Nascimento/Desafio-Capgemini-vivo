// ═══════════════════════════════════════════════════════════
// OlhoVivo AI — Firmware ESP32
//
// SENTIR: HC-SR04 → presença + tempo_parado
// AGIR:   3 LEDs no ponto de venda
//   LED 1 — engajar_informar    → cliente atento, destaca produto
//   LED 2 — converter_decisao   → cliente indeciso, oferece incentivo
//   LED 3 — recuperar_interesse → cliente saindo, chama atenção
//
// Bibliotecas necessárias (instalar via Library Manager):
//   - ArduinoJson  (versão 6.x)
// ═══════════════════════════════════════════════════════════

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "wifi";
const char* WIFI_PASSWORD = "senha";
const char* BACKEND_URL   = "https://costally-mythopoeic-alida.ngrok-free.dev/sensor/esp32";

#define TRIG_PIN   14
#define ECHO_PIN   27
#define LED1_PIN   25   // engajar_informar    — já conectado
#define LED2_PIN   32   // converter_decisao   — conectar quando disponível
#define LED3_PIN   33   // recuperar_interesse — conectar quando disponível

const float DISTANCIA_MAX_CM = 150.0;
const int   LEITURA_MS       = 500;
const int   POST_MS          = 3000;

bool          presenca       = false;
int           tempo_parado   = 0;
unsigned long presencaInicio = 0;
unsigned long ultimaLeitura  = 0;
unsigned long ultimoPost     = 0;

int    ledAtivoPin  = 0;       // qual pino está ativo agora (0 = nenhum)
String ledModo      = "apagado";
unsigned long ledUltimoTick = 0;
bool   ledEstado    = false;

// ── LEDs — apaga todos ───────────────────────────────────
void apagarTodos() {
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);
  digitalWrite(LED3_PIN, LOW);
  ledEstado = false;
}

// ── LED — atualiza o LED ativo no loop ───────────────────
void atualizarLED() {
  unsigned long agora = millis();

  if (ledAtivoPin == 0 || ledModo == "apagado") {
    apagarTodos();
    return;
  }

  if (ledModo == "fixo") {
    digitalWrite(ledAtivoPin, HIGH);

  } else if (ledModo == "pulso_suave") {   // 1200ms — sutil
    if (agora - ledUltimoTick >= 1200) {
      ledEstado = !ledEstado;
      apagarTodos();
      digitalWrite(ledAtivoPin, ledEstado);
      ledUltimoTick = agora;
    }

  } else if (ledModo == "pulso_lento") {   // 600ms — moderado
    if (agora - ledUltimoTick >= 600) {
      ledEstado = !ledEstado;
      apagarTodos();
      digitalWrite(ledAtivoPin, ledEstado);
      ledUltimoTick = agora;
    }

  } else if (ledModo == "pulso_rapido") {  // 200ms — urgente
    if (agora - ledUltimoTick >= 200) {
      ledEstado = !ledEstado;
      apagarTodos();
      digitalWrite(ledAtivoPin, ledEstado);
      ledUltimoTick = agora;
    }
  }
}

// ── Resolve pino pelo número do LED (1/2/3) ──────────────
int resolverPin(int ledNum) {
  if (ledNum == 1) return LED1_PIN;
  if (ledNum == 2) return LED2_PIN;
  if (ledNum == 3) return LED3_PIN;
  return 0;
}

// ── HC-SR04 ──────────────────────────────────────────────
float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long dur = pulseIn(ECHO_PIN, HIGH, 30000);
  if (dur == 0) return 999.0;
  return dur * 0.034 / 2.0;
}

// ── WiFi — reconexão automática ──────────────────────────
void reconectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[OlhoVivo] WiFi caiu — reconectando...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 20) {
    delay(500); Serial.print("."); t++;
    atualizarLED();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OlhoVivo] Reconectado: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[OlhoVivo] Falha — tenta em 3s");
  }
}

// ── Backend ───────────────────────────────────────────────
void enviarAoBackend() {
  reconectarWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  StaticJsonDocument<128> doc;
  doc["presenca"]     = presenca;
  doc["tempo_parado"] = tempo_parado;
  doc["distancia_cm"] = medirDistancia();

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);

  if (httpCode == 200) {
    String resposta = http.getString();
    StaticJsonDocument<256> resp;
    if (!deserializeJson(resp, resposta)) {
      String estado      = resp["estado"]        | "idle";
      int    ledNum      = resp["led"]           | 0;
      String modo        = resp["led_modo"]      | "apagado";
      String acaoCliente = resp["acao_cliente"]  | "nenhuma_acao";
      String acaoVend    = resp["acao_vendedor"] | "";

      Serial.printf("[OlhoVivo] %s | LED%d %s | %s | %s\n",
                    estado.c_str(), ledNum, modo.c_str(),
                    acaoCliente.c_str(), acaoVend.c_str());

      ledAtivoPin = resolverPin(ledNum);
      ledModo     = modo;
      if (ledAtivoPin == 0) apagarTodos();
    }
  } else {
    Serial.printf("[OlhoVivo] Erro HTTP %d\n", httpCode);
  }

  http.end();
}

// ── SETUP ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  apagarTodos();

  Serial.println("\n[OlhoVivo] Conectando WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 20) {
    delay(500); Serial.print("."); t++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OlhoVivo] WiFi: " + WiFi.localIP().toString());
    // Sequência de boot: acende LED1, LED2, LED3 em ordem
    for (int pin : {LED1_PIN, LED2_PIN, LED3_PIN}) {
      digitalWrite(pin, HIGH); delay(200);
      digitalWrite(pin, LOW);  delay(100);
    }
  } else {
    Serial.println("\n[OlhoVivo] Sem WiFi");
  }
}

// ── LOOP ──────────────────────────────────────────────────
void loop() {
  unsigned long agora = millis();

  atualizarLED();

  if (agora - ultimaLeitura >= LEITURA_MS) {
    ultimaLeitura = agora;
    float dist     = medirDistancia();
    bool  presente = (dist < DISTANCIA_MAX_CM);
    bool  mudou    = (presente != presenca);

    if (presente && !presenca) {
      presenca = true; presencaInicio = agora; tempo_parado = 0;
    } else if (!presente && presenca) {
      presenca = false; tempo_parado = 0;
      ledAtivoPin = 0; ledModo = "apagado"; apagarTodos();
    } else if (presente) {
      tempo_parado = (agora - presencaInicio) / 1000;
    }

    if (mudou || (presente && tempo_parado % 5 == 0 && tempo_parado > 0)) {
      Serial.printf("[Sensor] dist=%.0fcm | presente=%s | tempo=%ds\n",
                    dist, presente ? "SIM" : "NAO", tempo_parado);
    }
  }

  if (agora - ultimoPost >= POST_MS) {
    ultimoPost = agora;
    enviarAoBackend();
  }
}
