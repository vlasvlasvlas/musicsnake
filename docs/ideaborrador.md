# SnakeSynth: Laurie Spiegel's Music Mouse × Snake Automata
## Documento Borrador de Diseño Conceptual y Técnico

---

## 1. Visión y Fundamentos Conceptuales

**SnakeSynth** es un instrumento musical experimental interactivo y generativo para navegador web, concebido como una intersección directa entre dos hitos de la computación:

1. **Snake (1976 / 1997):** La mecánica espacial discreta en dos dimensiones, la memoria temporal corporizada (el cuerpo es el rastro físico del pasado del movimiento), y el crecimiento dinámico a partir del consumo de elementos en la grilla.
2. **Music Mouse: An Intelligent Instrument (Laurie Spiegel, 1986):** El software pionero para Mac, Amiga y Atari ST que no requería digitación de teclado de piano tradicional, sino que dotaba al movimiento del cursor $(X, Y)$ de inteligencia contrapuntística, coordinando **cuatro voces polifónicas simultáneas** bajo tratamientos armónicos formales (movimiento contrario, espejo, paralelo, clusters) y escalas modales.

En **SnakeSynth**, el cursor estático de Music Mouse cobra vida, masa, inercia y memoria: **la víbora es a la vez intérprete, cinta de delay analógico y partitura espacial en movimiento**.

---

## 2. Arquitectura Polifónica: La Anatomía Sonora (Estrategia D)

Para evitar la saturación cacofónica de hacer sonar cada segmento individual a volumen pleno cuando la víbora mide decenas de celdas, se adopta un **modelo híbrido anatómico de cuatro voces con modulación tímbrica global**:

```
[ COLA: Voz 4 ] <====== [ CUERPO MEDIO: Voz 3 ] <====== [ CABEZA: Voz 1 & 2 ]
   Bajo / Drone               Contrapunto                      Soprano & Alto
  (Pedal Tonal)             (Regla Spiegel)                    (Coordenadas X/Y)
```

### Las Cuatro Voces Activas:
1. **Voz 1 — Soprano (Cabeza, Eje X):**  
   Mapea la coordenada horizontal de la cabeza a las notas de la escala activa. Paneo estéreo hacia la izquierda (`-0.65`).
2. **Voz 2 — Alto (Cabeza, Eje Y):**  
   Mapea la coordenada vertical de la cabeza a las notas de la escala activa. Paneo estéreo hacia la derecha (`+0.65`).
3. **Voz 3 — Tenor / Contrapunto (Punto Medio del Cuerpo, $L/2$):**  
   Toma las coordenadas del punto medio de la víbora y les aplica el tratamiento contrapuntístico de Spiegel seleccionado (Movimiento Contrario, Espejo, Acordes Paralelos, etc.). Paneo central-izquierdo (`-0.25`).
4. **Voz 4 — Bajo / Bordón Drone (Punta de la Cola, $L$):**  
   Toma la posición del extremo final de la cola y la transpone 1 o 2 octavas hacia el registro grave. Provee la base armónica fundamental del camino recorrido. Paneo central-derecho (`+0.25`).

### Modulación Tímbrica por Longitud (Masa de la Víbora):
A medida que la víbora come y crece en longitud:
* **Filtro Pasa-Bajos:** El corte de frecuencia (*cutoff*) se abre progresivamente, otorgándole mayor brillo y riqueza armónica.
* **Espacio y Reverb:** La densidad y el tiempo de decaimiento del reverb se expanden proporcionalmente al tamaño del cuerpo.
* **Profundidad de Delay:** Se intensifica la realimentación de la cinta de delay estéreo.

---

## 3. Sincronización al Reloj y Arpegiador (Clock Cuantizado)

* **Pulso de Reloj (BPM):** El avance de la víbora está cuantizado a una subdivisión musical (ej. corcheas o semicorcheas sincronizadas al tempo).
* **Cada tick del reloj:**
  1. La víbora da exactamente 1 paso de grilla en su dirección actual.
  2. Se evalúa el paso del arpegiador según el patrón activo:
     * **Ciclo Polifónico:** Disparo secuencial de voces ($1 \rightarrow 2 \rightarrow 3 \rightarrow 4$).
     * **Péndulo (Up/Down):** Secuencia $1 \rightarrow 2 \rightarrow 3 \rightarrow 2 \rightarrow 1$.
     * **Acorde Simultáneo:** Las 4 voces tocan juntas en cada paso.
     * **Drone Continuo:** Tonos sostenidos con modulación tímbrica suave.
     * **Aleatorio Cuántico:** Selección estocástica de voces por paso.
* **Interpolación Visual:** Aunque la lógica y el audio operan a pasos cuantizados, el motor gráfico de Canvas interpola suavemente la animación a 60 fps para lograr una estética orgánica y fluida.

---

## 4. Los Dos Modos de Operación

### A. Modo Juego (Performance Interactiva Lúdica)
* El usuario conduce a la víbora con teclado (Flechas / WASD), mouse o toques en pantalla.
* Cada giro en 90° produce quiebres de intervalo melódico inmediatos.
* **Mecánica de Colisión ("Muda de Piel"):**
  * Para evitar la frustración de un "Game Over" tradicional que corte abruptamente la música, chocar contra una pared o la propia cola dispara un **acorde de choque / disonancia estelar percusiva**.
  * La víbora "muda de piel", reduciéndose elegantemente a su tamaño inicial (4 segmentos) sin pausar el flujo del sintetizador ni romper la performance.

### B. Modo Automático (Instalación Generativa Autónoma)
* La víbora se desplaza de forma autónoma como un organismo vivo sin posibilidad de muerte.
* **Física de Bordes:** Las paredes operan en modo **Toroidal (Wrap)** —la víbora atraviesa los bordes y reaparece del lado opuesto— o **Rebote Acústico (Bounce)** —refleja su ángulo como un rayo de luz o una bola de billar armónica.
* **Algoritmos de Navegación Autónoma:**
  * **Harmonic Seeker:** La víbora busca activamente los orbes o notas consonantes más cercanas calculando distancias armónicas.
  * **Curvas de Lissajous:** Sigue trayectorias continuas oscilatorias en $X$ e $Y$ (como un osciloscopio analógico), produciendo melodías cíclicas infinitas al estilo del minimalismo americano (Terry Riley, Steve Reich, Laurie Spiegel).
  * **Paseo Browniano (Random Walk):** Deriva estocástica suave ideal para composiciones *ambient* contemplativas.
  * **Seguir Ratón (Mouse Follow):** El usuario puede guiar suavemente la trayectoria acercando el puntero sobre el lienzo.

---

## 5. El Comportamiento de los Orbes (Píxeles y Sonido)

Los orbes no son comida inerte: son **nodos de mutación armónica y energética** en el espacio bidimensional.

```
+--------------------------------------------------------------------------+
|                          MAPA DE ORBES ARMÓNICOS                         |
+----------+-------+---------+--------------------+------------------------+
| Tipo     | Glifo | Color   | Impacto Inmediato  | Mutación Continua      |
+----------+-------+---------+--------------------+------------------------+
| TONIC    |   ♩   | Cyan    | Campanita cristal  | Alarga el cuerpo (+1); |
|          |       | #00ffcc | Pluck brillante    | abre filtro y reverb   |
+----------+-------+---------+--------------------+------------------------+
| SCALE    |   §   | Magenta | Arpegio ascendente | Modula la escala/modo  |
|          |       | #ff0077 | en la nueva tónica | de la matriz entera    |
+----------+-------+---------+--------------------+------------------------+
| VOICING  |   ∿   | Ámbar   | Acorde desplegado  | Cambia el tratamiento  |
|          |       | #ffaa00 | en abanico estéreo | de Spiegel (3ra y 4ta) |
+----------+-------+---------+--------------------+------------------------+
| FILTER   |   ◬   | Violeta | Resonancia baja    | Barrido analógico de   |
|          |       | #9933ff | profunda           | filtro pasa-bajos      |
+----------+-------+---------+--------------------+------------------------+
| TEMPO    |   ⏱   | Celeste | Golpe de claqueta  | Acelera o desacelera   |
|          |       | #00ddff | doble              | el reloj del arpegio   |
+----------+-------+---------+--------------------+------------------------+
| SPACE    |   ◌   | Naranja | Shimmer con cola   | Swell de delay cinta   |
|          |       | #ff8800 | larga              | y reverberación total  |
+----------+-------+---------+--------------------+------------------------+
```

### Comportamiento en los Píxeles de la Grilla:
1. **Onda de Choque Concéntrica (Pixel Ripple):** Al ser consumido, el píxel emite una onda circular que expande su radio por la grilla, iluminando fugazmente los nombres de las notas situados en las reglas perimetrales.
2. **Pulso Bioluminiscente Corpóreo:** El color distintivo del orbe absorbido viaja físicamente a lo largo de las vértebras de la víbora, recorriendo desde la cabeza hasta la punta de la cola.
3. **Plantar Orbes con Click:** El usuario puede hacer clic en cualquier coordenada vacía del lienzo para plantar un nodo sonoro a voluntad.

---

## 6. Panel de Configuración Lateral (Sidebar Settings)

El sidebar proporciona acceso directo a todos los parámetros del instrumento:

1. **Resolución de la Grilla ($N \times N$):**
   * `$16 \times 16$` (Minimalista / Saltos interválicos amplios).
   * `$24 \times 24$` (Equilibrio clásico para interpretación y tempo medio).
   * `$32 \times 32$` (Sinfónico / Alta resolución melódica de 4 octavas).
   * `$48 \times 48$` (Lienzo extendido para atractores y derivas lentas).
2. **Tratamientos Armónicos de Laurie Spiegel:**
   * Movimiento Contrario (*Contrary Motion*).
   * Acordes Paralelos en 5tas y 4tas (*Parallel Motion*).
   * Reflejo Axial (*Mirror*).
   * Racimos Microtonales (*Close Clusters*).
   * Canon Desfasado por Segmentos (*Snake Canon Delay*).
3. **Sistemas de Escalas y Modos:**
   * Pentatónica Mayor y Menor.
   * Modos Griegos: Dórico, Lidio, Mixolidio, Eólico.
   * Escalas Tradicionales Orientales: Hirajōshi (Koto), Insen (Shakuhachi).
   * Escalas Experimentales: Whole-Tone (Debussy), Blues Hexatónica, Cromática Libre.
4. **Motor de Síntesis y Envelopes:**
   * Formas de onda: Triangular analógica, Diente de sierra, Senoidal pura, Cuadrada chiptune.
   * Controles de ADSR (Ataque, Decay, Sustain, Release).
   * Filtro Pasa-bajos con resonancia ajustable ($Q$).
   * Stereo Tape Delay (Tiempo, Feedback, Nivel de mezcla).
   * Reverb Convolutivo / Algorítmico espacial.
5. **Comportamiento del Autómata:**
   * Selector de conducta autónoma (Harmonic Seeker, Lissajous, Brownian, Mouse Follow).
   * Física de muros (Toroidal Wrap, Rebote Acústico, Clásico).
6. **Conectividad MIDI:**
   * Soporte Web MIDI API para transmitir mensajes NoteOn / NoteOff a DAWs externos (Ableton Live, Logic Pro, sintetizadores modulares, hardware USB-MIDI).

---

## 7. Banco de Presets Iniciales

* **"Laurie Spiegel (1986)":** Pentatónica mayor en Do, onda triangular cálida, contrapunto contrario, delay suave de cinta a 110 BPM.
* **"Lydian Dreamscape":** Escala lidia en Fa, onda senoidal pura, reverb al 65%, arpegiador estilo drone, navegación por curvas de Lissajous a 85 BPM.
* **"Berlin School Arp":** Modo dórico en La, onda diente de sierra con filtro resonante, acordes paralelos a 132 BPM (homenaje a Tangerine Dream y Klaus Schulze).
* **"Hirajōshi Zen Garden":** Escala tradicional japonesa de koto en Re, tratamiento espejo y paseo browniano a 96 BPM.
* **"Acid Slither":** Escala por tonos enteros, onda cuadrada con alta resonancia y clusters armónicos a 140 BPM.

---

*Documento borrador generado para el repositorio `snakesynth`.*
