# MusicSnake — Camino 1: Spiegel-First Sound Deepening
Design document — 2026-11-22

## 1. Intención y por qué

MusicSnake es, por decisión del autor, tres cosas a la vez: instrumento musical personal, pieza de performance en vivo proyectable, y obra para muestra de arte interactivo. Su esencia conceptual se divide en tres canales que no deben contaminarse:

- **Ojo** → Snake del Nokia 1100 (LCD verde fósforo, puro).
- **Movimiento** → la víbora como organismo vivo en la grilla.
- **Oído** → Laurie Spiegel: *Music Mouse* (1986), sus patterns, timbres, armonías y filosofía de instrumento-inteligente.

La versión actual (noviembre 2026) cumple la fachada Nokia y el esqueleto polifónico de 4 voces, pero no cumple la promesa Spiegel: le falta lo específico de *Music Mouse* como instrumento — los 10 patterns canónicos de alturas, los dos tempos alternables, la articulación staccato/legato, el group behavior, y la modulación tímbrica por "masa" del instrumento. Ese déficit lo nota cualquier músico que escuche 30 segundos: suena a arpegiador genérico, no a Spiegel.

Este documento define el **Camino 1 del proyecto**: profundizar lo que se escucha, incorporando además dos extensiones que emergieron en brainstorming como traducciones fieles al Nokia de principios Spiegelianos.

## 2. Alcance

### 2.1 Goals

G1. El instrumento debe sonar reconociblemente como una pieza *Music Mouse*-like a un musicólogo que escucha sin mirar.
G2. La curva de complejidad musical debe escalar con el crecimiento de la víbora — arrancar en una voz, llegar a cuatro.
G3. La pantalla debe hacer visibles las voces activas sin romper la estética Nokia LCD (verde fósforo monocromo).
G4. El modo auto debe ser capaz de generar material no-repetitivo durante horas (requisito de instalación en muestra).
G5. Compatibilidad con MIDI Out existente (no romper nada).

### 2.2 Non-goals

NG1. No agregar reglas de piano externas en los bordes del canvas (vive dentro de la grilla, forma A y B).
NG2. No cambiar la lógica de steering autónomo (eso es Camino 2).
NG3. No expandir el sistema de hotkeys ni agregar hint bar permanente (eso es Camino 3).
NG4. No agregar MIDI Clock Sync In.
NG5. No rediseñar el panel de settings; agregar controles donde haga falta sin refactor.

### 2.3 Anti-goals (lo que haría fallar aunque técnicamente funcione)

AG1. Contaminar visualmente la pantalla Nokia con colores Spiegel (líneas color por voz, keyboard rulers, etc.).
AG2. Que el modo juego pierda su carácter Snake-Nokia reconocible.
AG3. Que la muda de piel (choque en modo juego) corte abruptamente el flujo musical.
AG4. Patterns que suenen a arpegiador MIDI genérico y no a Spiegel.

## 3. Restricciones

R1. Vanilla JS + Web Audio API + Canvas 2D. Sin build step, sin frameworks.
R2. El reloj de música actual vive en `app.js` tickMusicClock, llamado desde `start()` loop. No romper esa arquitectura.
R3. El pipeline de voces actual (`music.js` `getVoices()`) devuelve 4 voces siempre; hay que cambiar la firma para que respete active-voice-count.
R4. `audio.js` `triggerVoiceNote()` hoy dispara-y-olvida. Full-legato requiere refactor para retriggering gestionado.
R5. El renderer actual (`renderer.js`) sólo conoce segmentos y comida. Hay que extender su interfaz para que reciba las voces activas y sus posiciones de origen.

## 4. Enfoque considerado

Se evaluaron dos formas de aplicar los patterns de Music Mouse:

**Enfoque A — Pattern como delta/offset sobre pitch XY.** El pitch base sigue derivándose de la geometría de la víbora; el pattern agrega un offset en grados de escala que cicla en cada tick. Semántica fiel al PDF pág 7 (el parámetro Symmetry de MM aplica el pattern como movimiento Parallel/Contrary sobre la base del cursor). Preserva el pipeline existente y las 5 relaciones contrapuntísticas.

**Enfoque B — Pattern como reemplazo de pitch.** El pattern se vuelve el generador principal de altura; la geometría de la víbora se reutiliza para controlar otros parámetros (octava, voicing). Más estilo "secuenciador clásico".

**Decisión (autor):** Enfoque A. Razón: respeta la semántica Spiegel original y compone sin conflicto con treatments, growth-gating y group behavior. El B tiraría del instrumento hacia "secuenciador MIDI" y lo alejaría de la víbora-como-cursor-vivo que es el corazón de la idea.

## 5. Features que entran

Ocho features, en orden sugerido de implementación (cada una desbloquea o simplifica la siguiente).

### 5.1 Feature A — Growth-gated voicing (voces desbloqueadas por tamaño)

Cantidad de voces activas se deriva del largo de la víbora según umbrales:

| Segmentos | Voces activas | Origen (Spiegel) |
|-----------|---------------|------------------|
| 1 | 1 (Soprano) | Mano humana (X cabeza) |
| 2–3 | 2 (Soprano + Alto) | Mano humana (X e Y cabeza) |
| 4–7 | 3 (+ Tenor) | **Spiegel supplies**: contrapunto en punto medio del cuerpo |
| 8+ | 4 (+ Bajo) | **Spiegel supplies**: drone en cola |

Lógica filosófica: en *Music Mouse*, el usuario tocaba 2 voces (XY del mouse) y el software proveía las otras 2. Acá el usuario arranca con 1–2 voces y gana las 2 "del software" al crecer. El crecimiento pasa a ser el acto de hacerse-instrumento-Spiegel.

Cambios concretos:
- `MusicTheory.getVoices(pos, history, treatment, activeVoiceCount)` acepta un nuevo parámetro y retorna sólo las voces activas. Las voces no devueltas no se calculan.
- `app.js` `tickMusicClock()` computa `activeVoiceCount` desde `snake.segments.length` con la tabla de arriba.
- `app.js` `triggerVoiceArpeggio(voices)` ya recibe el array truncado; su lógica actual sirve con `voices.length < 4`.

### 5.2 Feature B — Reflejos monocromos columna/fila en la grilla

Para cada voz activa, se ilumina la columna y/o fila de su "punto de origen" con un verde ligeramente más claro que el LCD_BOARD base (del mismo hue family — ej. `#b8d475` sobre `#aacc66`).

Mapeo voz → qué se ilumina:

| Voz | Punto de origen | Ilumina |
|-----|-----------------|---------|
| 1 (Soprano) | Cabeza | Columna X de la cabeza |
| 2 (Alto) | Cabeza | Fila Y de la cabeza |
| 3 (Tenor) | Punto medio del cuerpo | Columna + fila de ese segmento |
| 4 (Bajo) | Cola | Columna + fila de la cola |

Cuando la voz está sonando *en este tick* → opacidad alta (ej. alpha 0.35). Cuando está activa pero muda este tick (arpegiador ciclando) → opacidad baja (alpha 0.12) o cero según decisión estética del constructor.

Decisión estética (autor): mantener un brillo residual fantasma (alpha ~0.08) en las voces activas pero mudas, para que se vea el "campo armónico" aunque no suene todo todo el tiempo.

Cambios concretos:
- `renderer.js` nueva función `drawVoiceHighlights(ctx, snake, activeVoices, playingVoiceIdxs, cw, ch)`.
- `renderer.render()` acepta `playingVoiceIdxs` (índices que sonaron este tick) como parámetro adicional.
- Dibujar DEBAJO de los foods y la víbora para que no los oculte.

### 5.3 Feature C — Muda de piel repliega voces

Cuando la víbora choca con pared (modo `classic`) o consigo misma, en vez del Game Over tradicional:
- Se dispara el acorde de impacto existente (`triggerImpactSound`).
- La víbora se reduce a 1 segmento (no a 4 como hoy en el código — queremos **ver el regreso a Soprano pura**).
- Growth queue a 0.
- Posición de reset: donde estaba la cabeza en el momento del choque (continuidad espacial).
- Música no pausa; sigue sonando con las voces desbloqueadas (que por ser 1 segmento = soprano sola).

Filosofía: inspirado en la cita de Spiegel *"the way to keep it silent is to just not play it"*. El choque no es muerte; es silencio restaurado, puesta a cero poética. Hay que crecer de nuevo para ganar las otras voces.

Cambios concretos:
- `app.js` `tickMusicClock()` reemplaza el reseteo actual a `slice(0, 4)` por `slice(0, 1)` para self-collision (ya existente) **y también para wall-collision en modo `classic`**.
- La muda se dispara tanto por chocar la pared en `classic` wallMode como por chocar la propia cola. Modos `wrap` y `bounce` no activan muda (la víbora sigue de largo o rebota).
- Posición de reset:
  - Self-collision: el segmento 0 queda en la posición donde la cabeza intentó moverse (ya calculada por `step()`).
  - Wall-collision classic: hoy `step()` early-returns *antes* de agregar el nuevo segmento; para muda, la cabeza queda en su última posición válida (el segmento 0 anterior al step).
- **Full-legato + muda:** cuando el activeVoiceCount baja de N a 1 por muda, las voces N-1..2 que tengan osciladores activos en `SynthEngine.activeVoiceNodes` deben ser liberadas inmediatamente (release-ramp 0.15s). Dejar drones colgados contradice el principio "silencio restaurado" de esta feature.

### 5.4 Feature D — Patterns de Music Mouse (10 secuencias de altura)

Las 10 secuencias canónicas del PDF pág 7 se implementan como arrays de grados de escala:

```js
export const MM_PATTERNS = {
  off:  { label: 'Off', deltas: [0] },
  p1:   { label: '10-note cycle', deltas: [0, 4, 5, 0, 4, 3, 4, 5, 0, 4] },
  p2:   { label: '6-note triadic arp', deltas: [0, 2, 4, 7, 4, 2] },
  p3:   { label: '8-note cycling scale', deltas: [0, 1, 2, 3, 4, 3, 2, 1] },
  p4:   { label: '14-note cycling scale', deltas: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1] },
  p5:   { label: '8-note extended triadic', deltas: [0, 4, 7, 11, 7, 4, 7, 4] },
  p6:   { label: '16-note stepwise', deltas: [0, 1, 0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 2, 1, 2, 1] },
  p7:   { label: '10-note cycle B', deltas: [0, 2, 3, 4, 5, 6, 5, 4, 3, 2] },
  p8:   { label: '16-note cycle', deltas: [0, 7, 1, 6, 2, 5, 3, 4, 5, 2, 4, 5, 2, 6, 1, 7] },
  p9:   { label: '8-note cycle', deltas: [0, 1, 4, 1, 0, 4, 0, 4] },
  p10:  { label: '16-note cycle B', deltas: [0, 7, 0, 0, 2, 1, 2, 4, 3, 2, 1, 2, 0, 0] }
};
```

Aplicación: cada tick, un cursor `patternStep` avanza en 1 posición (modulo deltas.length). El delta en esa posición se suma a los índices de nota de las voces, DESPUÉS de que `getVoices` calculó los pitches base. El delta es en grados de escala, no semitonos — convertido a semitonos pasando por el pattern de la escala activa.

Símetría (parámetro adicional):
- `parallel`: el delta se aplica igual a las 4 voces (todas suben/bajan juntas).
- `contrary`: voces 1 y 3 reciben `+delta`; voces 2 y 4 reciben `-delta` (reflejado).

Un pattern = `off` deja todo como está hoy (sin modular). Default `off` para que el instrumento se comporte igual al actual hasta que el usuario active un pattern.

**Semántica del delta (decisión):** el delta es un desplazamiento del índice dentro del array plano `gridNotes` que ya devuelve `MusicTheory.cacheGridNotes()`. Es decir: `appliedIdx = (baseIdx + delta + len) % len` donde `len = gridNotes.length`. Esto es octave-aware (las octavas ya están codificadas en la secuencia plana), wrappea cíclicamente para deltas grandes como `11` en `p5/p8`, y wrappea en el extremo bajo para deltas negativos bajo `contrary` symmetry. No requiere reconstruir intervalos desde `SCALES[key].intervals`.

Cambios concretos:
- `music.js` exportar `MM_PATTERNS` + nueva clase/estructura.
- `MusicTheory.applyPattern(voices, patternKey, patternStep, symmetry)` que modifica voces in-place (devuelve nuevas con pitch ajustado).
- `app.js` nuevo estado `this.currentPattern = 'off'`, `this.currentSymmetry = 'parallel'`, `this.patternStep = 0`. Incrementar step cada tick. UI: dos selects nuevos en el settings panel.

### 5.5 Feature E — Dos tempos alternables

Música Mouse tenía Tempo 1 (default 75 BPM) y Tempo 2 (default 150 BPM), con hotkey `\` para alternar.

Modelo simplificado: un solo tempo "activo" a la vez (no polirritmia multi-voz — eso es territorio Camino 2/3). Dos valores guardados + switch.

Cambios concretos:
- `app.js` reemplazar `this.bpm` por `this.bpm1 = 110`, `this.bpm2 = 165`, `this.activeTempo = 1`.
- Getter `get bpm()` que retorna el activo.
- UI: dos sliders en settings panel + un botón de toggle.
- Hotkey `\` alterna entre 1 y 2.

### 5.6 Feature F — Articulación (Staccato / Half-legato / Full-legato)

Define el duration de las notas disparadas:

| Modo | Duration | Comportamiento |
|------|----------|----------------|
| Staccato | 1/16 nota (60/bpm * 0.25) | Corto, picado |
| Half-legato | 1/4 nota (60/bpm * 0.5) | Medio (default actual) |
| Full-legato | hasta próximo retrigger | Infinito; release only cuando esa voz vuelve a sonar |

Full-legato es el único que requiere cambio arquitectónico en `audio.js`:
- `SynthEngine` mantiene `this.activeVoiceNodes = [null, null, null, null]` — una referencia por voz al oscilador vivo.
- `triggerVoiceNote(freq, voiceIdx, duration, velocity, articulation)` acepta articulation. Si full-legato:
  1. Si hay nodo activo en voiceIdx: cancelScheduledValues y release-ramp sobre su gain (0.08s), schedule stop.
  2. Crea el nuevo oscilador, lo guarda en activeVoiceNodes[voiceIdx], sin stopTime pre-programado.
- Staccato/Half-legato: comportamiento actual (dispara-y-olvida con stop programado).

Cambios concretos:
- `app.js` nuevo estado `this.articulation = 'halfLegato'`.
- Select en settings panel.

### 5.7 Feature G — Group behavior

En *Music Mouse* (PDF pág 6, tecla `G`): cuando está ON, cualquier cambio de pitch en una voz dispara el retrigger de TODAS las voces activas en el próximo beat; cuando OFF, cada voz sólo dispara cuando su propio pitch cambia.

Hoy MusicSnake no hace comparación tick-a-tick de pitches; dispara según `arpPattern` sin considerar si el pitch cambió. Group agrega una capa de decisión ANTES del arpeggiator:

```
tick:
  compute newVoices
  changedMask = diff(newVoices, previousVoices)   // por voice index
  if group ON:
    if any(changedMask): trigger all active voices
    else: silence (nada suena este tick)
  else:
    apply current arpPattern to the active voices
    (cada voz sólo suena si arpPattern la selecciona Y su pitch cambió desde la última vez que sonó)
```

Group OFF cuando `arpPattern = chord` colapsa al comportamiento actual de chord. Group ON produce la textura típica de Spiegel: largas notas sostenidas que se reconfiguran como bloque cuando el cursor cambia de nota en algún eje.

**Semántica del diff (decisión):** el cambio de pitch se compara contra las **voces pre-pattern** — es decir, los pitches que salen de `getVoices()` antes de que `applyPattern()` sume el delta. Razón: los patterns rotan su delta en cada tick, así que diff post-pattern dispararía Group ON casi en todos los ticks (el pattern cambió el delta aunque el snake no se movió), lo que mataría la semántica Spiegel original donde Group responde al movimiento del *cursor*, no al avance del *arpegiador*. Pre-pattern preserva que el evento gatillante es la víbora moviéndose en la grilla.

**Alcance del pitch-change gate en Group OFF (decisión):** el gate "sólo suena si la voz cambió" aplica **únicamente** cuando `arpPattern = chord` o `drone` (modos que disparan todas las voces simultáneas). Para `cycle` / `upDown` / `random` el gate NO aplica — esos patterns disparan voces según su propia lógica independientemente del cambio de pitch, igual que hoy. Esto preserva el criterio de validación "Pattern Off produce el mismo output que la versión actual del código" (sección 9).

Cambios concretos:
- `app.js` nuevo estado `this.groupMode = false`.
- `app.js` mantener `this.previousVoicePitches = [null, null, null, null]`.
- `triggerVoiceArpeggio()` refactor con lógica de arriba.

### 5.8 Feature H — Modulación tímbrica extendida por longitud

Hoy sólo filterCutoff se modula por largo (línea app.js:622-625, ratio 1→2x). Extender a tres parámetros con curvas más expresivas:

| Parámetro | Base (len=1) | Cap (len≥32) | Curva |
|-----------|--------------|--------------|-------|
| filterCutoff | 1.0x base | 3.5x base | sqrt(len/8) |
| reverbMix | 0.9x base | 1.6x base | lineal |
| delayFeedback | 0.85x base | 1.35x base | lineal |

Clamp final sobre filterCutoff a 9500 Hz, reverbMix a 0.9, delayFeedback a 0.75 para evitar oscilación/distorsión.

Cambios concretos:
- `app.js` `tickMusicClock()` extender el bloque existente (líneas 622-625) para modular los tres parámetros.
- `SynthEngine` expone setters que ya existen; sólo hay que llamarlos.

### 5.9 Feature I — Freeze / sustain de la víbora

En *Music Mouse*, Spiegel podía quedarse quieta con el mouse y sostener el acorde — lo que llamaba *"the way to keep it silent is to just not play it"*. Hoy MusicSnake no permite esto: la víbora avanza forzosamente con el reloj. Esta feature restaura esa posibilidad.

Interacciones:

| Input | Comportamiento |
|-------|----------------|
| Click-hold sobre canvas | Freeze momentáneo mientras el botón está apretado (equivale a pedal de sustain) |
| Doble click / doble tap sobre canvas | Toggle freeze on/off (modo latch: queda frozen hasta próximo doble click) |
| Spacebar | Se mantiene como play/pause global; no se toca |

Semántica del freeze:
- El reloj de música sigue corriendo (los `requestAnimationFrame` no se pausan).
- Pero el bloque de avance de `tickMusicClock` (steps 1-12 del orden de ejecución, sección 6) se SKIPEA mientras `this.isFrozen` sea true.
- No se calculan voces nuevas, no se dispara ningún note, no se avanza el pattern step.
- Los osciladores vivos (full-legato) siguen sonando; los no-legato decaen solos.
- En modo juego, el usuario puede cambiar la dirección pretendida con flechas/WASD durante el freeze, pero esa dirección solo se aplica cuando se desfreeze.
- El renderer sí sigue corriendo (visualmente nada cambia excepto quizás un indicador sutil — ver abajo).

Indicador visual (decisión estética del constructor, no obligatorio):
- Opción: la víbora parpadea muy suavemente a 1 Hz para indicar que está en pausa. Monocromo, sin romper Nokia.
- Opción alternativa: no indicar nada, dejar que la ausencia de movimiento sea la señal.

Cambios concretos:
- `app.js` nuevo estado `this.isFrozen = false`.
- `tickMusicClock()` wrapea los steps 1-12 en `if (!this.isFrozen) { ... }`. El step 13 (renderer) corre siempre.
- `bindCanvasInteraction()` — agregar `mousedown` para set frozen=true, `mouseup` para set frozen=false (click-hold).
- `bindCanvasInteraction()` — agregar `dblclick` para toggle `this.isFrozen`.
- Mobile touch: `touchstart` hold >200ms → freeze mientras se mantiene. Double-tap (dos touches en <300ms) → toggle.
- Cuidado: no confundir freeze con el actual `mouseTarget` (en modo auto, el mouse ya guía la víbora). Decisión: click-hold toma precedencia sobre mouseTarget — mientras hold, mouseTarget se congela también.

## 6. Interacciones entre features (orden de aplicación por tick)

Para evitar ambigüedad, el orden exacto de procesamiento en cada `tickMusicClock()`:

```
0. if (this.isFrozen) skip al step 13                 [Feature I]
1. snake.updateAutonomousSteering() + snake.step()   [sin cambios]
2. Detectar muda de piel (Feature C)                  [modificado]
3. Consumir food                                      [sin cambios]
4. Calcular activeVoiceCount desde snake.length       [Feature A]
5. getVoices(head, history, treatment, activeVoiceCount)  [Feature A modificado]
6. applyPattern(voices, pattern, step, symmetry)      [Feature D nuevo]
7. Comparar con previousVoicePitches                  [Feature G nuevo]
8. Decidir qué voces suenan este tick según group + arpPattern + articulation  [Features F+G]
9. Para cada voz que suena: triggerVoiceNote(freq, idx, dur según articulation)  [Feature F modificado]
10. Modular timbre por longitud (filter + reverb + delay)  [Feature H extendido]
11. Guardar previousVoicePitches                      [Feature G nuevo]
12. patternStep++                                     [Feature D nuevo]
13. renderer.render(snake, foods, music, voices, playingVoiceIdxs)  [Feature B modificado]
```

## 7. Cambios de UI (settings panel)

Nuevos controles a sumar en el orden actual del panel:

- Select "Pattern" (11 opciones: Off + p1..p10)
- Select "Symmetry" (Parallel / Contrary) — visible sólo cuando Pattern ≠ Off
- Select "Articulation" (Staccato / Half-legato / Full-legato)
- Checkbox "Group" (play all when any changes)
- Slider "BPM 2" + botón toggle Tempo 1 / Tempo 2

Todo esto convive con el panel actual; no se rediseña el layout.

## 8. Cambios de presets

Los 5 presets existentes (`spiegel1986`, `ambientLydian`, `berlinArp`, `kotoZen`, `acidSlither`) ganan 5 campos nuevos: `pattern`, `symmetry`, `articulation`, `group`, `bpm2`. Valores propuestos por el constructor; sugerencias:

- `spiegel1986`: pattern `p2` (triadic arp), symmetry `contrary`, articulation `halfLegato`, group `off`, bpm2 165.
- `ambientLydian`: pattern `p4` (14-note scale), symmetry `parallel`, articulation `fullLegato`, group `on`, bpm2 42.
- `berlinArp`: pattern `p1` (10-note cycle), symmetry `parallel`, articulation `staccato`, group `off`, bpm2 264.
- `kotoZen`: pattern `off`, symmetry `parallel`, articulation `fullLegato`, group `on`, bpm2 48.
- `acidSlither`: pattern `p8` (16-note irregular), symmetry `contrary`, articulation `staccato`, group `off`, bpm2 280.

## 9. Testing / validación

No hay suite de tests en el repo actual. Testing manual mínimo antes de considerar la feature cerrada:

- Cada preset reproduce coherentemente los 5 valores nuevos al cargarse.
- La víbora recién reseteada suena a 1 voz; al llegar a 2, 4, 8 segmentos la textura efectivamente cambia (auditivo).
- Choque en modo classic reduce a 1 segmento sin pausar audio; la música sigue.
- Grilla muestra highlights cuando hay voces activas; no hay highlights con 1 voz.
- Pattern Off produce el mismo output que la versión actual del código.
- Group ON + arpPattern chord deben sonar idénticos (edge case que confirma el refactor no rompió nada).
- Full-legato: cambiar escala mid-performance no deja oscilador colgado (stress-test con 5 cambios rápidos).

## 10. Lo que queda al constructor

Decisiones delegadas con criterio:

- Alpha exacto de los highlights (0.08 fantasma / 0.35 sonando): afinar visualmente contra el verde `#aacc66`.
- Color exacto del highlight: proponer un verde más claro del mismo hue, ajustar hasta que lea bien proyectado a 1080p.
- **Modo de compositing de highlights superpuestos** (ej. fila Tenor + fila Bajo coinciden, o highlight cruza el cuerpo): se sugiere `globalCompositeOperation = 'source-over'` con un cap por celda — si una celda recibiría más de un rect de highlight, aplicar sólo el de alpha más alto (dedup por coordenada antes del fill). Alternativamente, dibujar con `'lighter'` capado a alpha 0.4 total. Afinar según lectura visual.
- Ubicación exacta de los nuevos controles en el DOM del `settingsPanel`.
- Keybinding `\` para toggle de tempo: implementar en `handleKeyDown`.
- Indicador visual sutil durante freeze (parpadeo suave 1 Hz) — implementar o no según prueba visual.
- Preservar el resto del comportamiento existente (keybindings Q/W/E/R/T, 1-8, modo juego, auto, etc).

Fuera de alcance (no tocar en esta iteración):

- Visual Spiegel en bordes del canvas (piano rulers).
- Cambios a algoritmos de steering autónomo.
- Pitch-rhythm barrier mode, waveform crossfade (quedaron descartados explícitamente para esta ronda).
- MIDI Clock Sync In.
- Multi-snake.

## 11. Entrega

Al terminar la implementación:
- Un commit por feature (A, B, C, D, E, F, G, H) para facilitar revisión.
- README actualizado con mención de los nuevos conceptos (patterns MM, growth-gated voicing).
- Capture mínimo (video 15s o 3 screenshots) verificando que la víbora de 1 segmento suena monofónica y la de 12 suena a cuarteto.
