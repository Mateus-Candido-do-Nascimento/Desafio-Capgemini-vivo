// ═══════════════════════════════════════════════════════════
// OlhoVivo AI — Firmware ESP32
//
// SENTIR: HC-SR04 → presença + tempo_parado
// AGIR:   LED no ponto de venda
//
// Bibliotecas necessárias (instalar via Library Manager):
//   - ArduinoJson  (versão 6.x)
// ═══════════════════════════════════════════════════════════

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "Brasilino2G";
const char* WIFI_PASSWORD = "42081467";
const char* BACKEND_URL   = "https://costally-mythopoeic-alida.ngrok-free.dev/sensor/esp32";

#define TRIG_PIN   14
#define ECHO_PIN  27
#define LED_PIN    2

const float DISTANCIA_MAX_CM = 150.0;
const int   LEITURA_MS       = 500;
const int   POST_MS          = 3000;

bool          presenca       = false;
int           tempo_parado   = 0;
unsigned long presencaInicio = 0;
unsigned long ultimaLeitura  = 0;
unsigned long ultimoPost     = 0;
String        ledAtual       = "apagado";
unsigned long ledUltimoTick  = 0;
bool          ledEstado      = false;

// ── LED ──────────────────────────────────────────────────
void atualizarLED() {
  unsigned long agora = millis();
  if (ledAtual == "fixo") {
    digitalWrite(LED_PIN, HIGH);
  } else if (ledAtual == "pulso_suave") {
    if (agora - ledUltimoTick >= 1200) {
      ledEstado = !ledEstado;
      digitalWrite(LED_PIN, ledEstado);
      ledUltimoTick = agora;
    }
  } else if (ledAtual == "pulso_lento") {
    if (agora - ledUltimoTick >= 600) {
      ledEstado = !ledEstado;
      digitalWrite(LED_PIN, ledEstado);
      ledUltimoTick = agora;
    }
  } else {
    digitalWrite(LED_PIN, LOW);
    ledEstado = false;
  }
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
      String estado   = resp["estado"]        | "idle";
      String led      = resp["led"]           | "apagado";
      String acaoVend = resp["acao_vendedor"] | "";

      Serial.printf("[OlhoVivo] %s | led=%s | %s\n",
                    estado.c_str(), led.c_str(), acaoVend.c_str());

      ledAtual = led;
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
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n[OlhoVivo] Conectando WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 20) {
    delay(500); Serial.print("."); t++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OlhoVivo] WiFi: " + WiFi.localIP().toString());
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH); delay(150);
      digitalWrite(LED_PIN, LOW);  delay(150);
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
      ledAtual = "apagado";
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
