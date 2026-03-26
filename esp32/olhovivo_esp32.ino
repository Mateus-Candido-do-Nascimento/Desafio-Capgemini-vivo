// ═══════════════════════════════════════════════════════════
// OlhoVivo AI — Firmware ESP32
//
// SENTIR: HC-SR04 → presença + tempo_parado
// AGIR:   LED + LCD voltados ao cliente no ponto de venda
//
// Bibliotecas necessárias (instalar via Library Manager):
//   - ArduinoJson        (versão 6.x)
//   - LiquidCrystal_I2C  (por Frank de Brabander)
// ═══════════════════════════════════════════════════════════

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const char* WIFI_SSID     = "MCN";
const char* WIFI_PASSWORD = "12345678";
const char* BACKEND_URL   = "https://costally-mythopoeic-alida.ngrok-free.dev/sensor/esp32";

#define TRIG_PIN   5
#define ECHO_PIN  18
#define LED_PIN    2

LiquidCrystal_I2C lcd(0x27, 16, 2);
bool lcdDisponivel = false;

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

// ── LCD ──────────────────────────────────────────────────
void lcdMostrar(String linha1, String linha2) {
  if (!lcdDisponivel) return;
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(linha1);
  lcd.setCursor(0, 1); lcd.print(linha2);
}

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
  lcdMostrar("  Reconectando  ", "   aguarde...  ");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 20) {
    delay(500); Serial.print("."); t++;
    atualizarLED();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OlhoVivo] Reconectado: " + WiFi.localIP().toString());
    lcdMostrar("  Vivo Store   ", " Bem-vindo! :) ");
  } else {
    Serial.println("\n[OlhoVivo] Falha — tenta em 3s");
    lcdMostrar("  Vivo Store   ", " Sem conexao...");
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
    StaticJsonDocument<512> resp;
    if (!deserializeJson(resp, resposta)) {
      String estado   = resp["estado"]        | "idle";
      String lcd1     = resp["lcd_linha1"]    | "  Vivo Store   ";
      String lcd2     = resp["lcd_linha2"]    | " Bem-vindo! :) ";
      String led      = resp["led"]           | "apagado";
      String acaoVend = resp["acao_vendedor"] | "";

      Serial.printf("[OlhoVivo] %s | led=%s | %s\n",
                    estado.c_str(), led.c_str(), acaoVend.c_str());

      lcdMostrar(lcd1, lcd2);
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

  Wire.begin(21, 22);
  lcdDisponivel = true;
  lcd.init();
  lcd.backlight();
  lcdMostrar("  Vivo Store   ", " Conectando... ");

  Serial.println("\n[OlhoVivo] Conectando WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 20) {
    delay(500); Serial.print("."); t++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OlhoVivo] WiFi: " + WiFi.localIP().toString());
    lcdMostrar("  Vivo Store   ", " Bem-vindo! :) ");
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH); delay(150);
      digitalWrite(LED_PIN, LOW);  delay(150);
    }
  } else {
    Serial.println("\n[OlhoVivo] Sem WiFi");
    lcdMostrar("  Vivo Store   ", " Sem conexao...");
  }
}

// ── LOOP ──────────────────────────────────────────────────
void loop() {
  unsigned long agora = millis();

  atualizarLED();

  if (agora - ultimaLeitura >= LEITURA_MS) {
    ultimaLeitura = agora;
    float dist    = medirDistancia();
    bool  presente = (dist < DISTANCIA_MAX_CM);

    if (presente && !presenca) {
      presenca = true; presencaInicio = agora; tempo_parado = 0;
    } else if (!presente && presenca) {
      presenca = false; tempo_parado = 0;
      ledAtual = "apagado";
      lcdMostrar("  Vivo Store   ", " Bem-vindo! :) ");
    } else if (presente) {
      tempo_parado = (agora - presencaInicio) / 1000;
    }

    Serial.printf("[Sensor] dist=%.0fcm | presente=%s | tempo=%ds\n",
                  dist, presente ? "SIM" : "NAO", tempo_parado);
  }

  if (agora - ultimoPost >= POST_MS) {
    ultimoPost = agora;
    enviarAoBackend();
  }
}
