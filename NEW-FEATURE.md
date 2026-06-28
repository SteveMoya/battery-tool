# NEW-FEATURE.md — Battery Configuration & Analysis Tool

## Análisis de Features Críticas Faltantes

**Autor:** Ingeniero de Soluciones Energéticas  
**Fecha:** 28-06-2026  
**Proyecto:** BCA Tool (Battery Configuration & Analysis)  
**Metodología:** Revisión técnica contra estándares de la industria (IEC 62619, UN 38.3, UL 2580, ISO 12405, SAE J2464)

---

## Resumen Ejecutivo

El proyecto BCA Tool tiene una base sólida en diseño geométrico, simulación eléctrica básica y export. Sin embargo, para ser una herramienta profesional seria de uso en la industria de baterías, le faltan módulos críticos que cubren **seguridad operativa, gestión térmica, cumplimiento normativo, y diseño mecánico del pack**. Este documento enumera 12 features faltantes priorizadas por gravedad de implementación.

---

## F1 — Motor de Validación contra Estándares (Standards Compliance Engine)

### Por qué es crítica
El datasheet actual menciona "IEC 62619, UN 38.3, UL 2580" en el footer como texto estático. **No hay ninguna validación real contra estos estándares.** Un pack diseñado con esta herramienta podría ser rechazado en certificación o, peor aún, crear un riesgo de seguridad si se ignora un requisito obligatorio.

La industria de baterías tiene requisitos MÍNIMOS de diseño que no son opcionales:
- **IEC 62619**: Células secundarias de litio para aplicaciones industriales — define requisitos de seguridad funcional (overcharge, overdischarge, short circuit, thermal abuse)
- **UN 38.3**: Transporte de mercancías peligrosas — define pruebas de simulación que las celdas deben pasar
- **UL 2580**: Baterías para vehículos eléctricos — requisitos de seguridad para el pack completo
- **ISO 12405**: Pruebas de rendimiento de paquetes de baterías para vehículos eléctricos
- **SAE J2464**: Pruebas de abuso de baterías EV

### Gravedad de implementación: 🔴 ALTA (Safety-Critical)

### Pasos para implementar

1. **Crear módulo `standards-engine.ts`**
   - Definir interface `ComplianceRequirement` con: `standard`, `clause`, `description`, `category`, `mandatory`
   - Crear base de datos de requisitos por tipo de pack (S count, voltage range, chemistry)
   - Implementar `checkCompliance(packConfig): ComplianceReport` que valide cada requisito contra la configuración actual

2. **Definir reglas de validación**
   - **UN 38.3**: Validar que el voltaje del pack no exceda 100V (requisito de transporte) o identificar si requiere Class 9 hazardous material labeling
   - **IEC 62619**: Verificar que exista BMS con protección contra overcharge/overdischarge/short circuit
   - **UL 2580**: Para packs >48V o >20Ah, recomendar fusible de alta rotura de capacidad (HRC) y contactor
   - **ISO 12405**: Para packs EV, verificar que I_max del BMS sea ≥ 1.25× I_max del pack
   - Validar voltage de operación por química contra rangos de estándar

3. **Crear UI `StandardsSection.astro`**
   - Panel en sidebar con checklist de cumplimiento
   - Cada requisito muestra: ✅ Cumple / ⚠️ Advertencia / ❌ No cumple
   - Expandible para ver detalle del cláusula específica
   - Botón "Export Compliance Report" que genere PDF con los resultados

4. **Integrar con datasheet**
   - Agregar sección "Compliance Status" al PDF generado
   - Incluir número de cláusula y resultado para cada estándar aplicable

### Archivos afectados
- Nuevo: `src/scripts/standards-engine.ts`
- Nuevo: `src/components/sidebar/StandardsSection.astro`
- Modificar: `src/scripts/datasheet.ts` (agregar compliance al PDF)
- Modificar: `src/scripts/diagnostic.ts` (agregar compliance al global diagnostic)

---

## F2 — Motor Térmico de Celdas (Cell Thermal Engine)

### Por qué es crítica
El cálculo térmico actual (`diagnostic.ts`) usa un modelo **extremadamente simplificado**: `T_cell = T_amb + Q_per_cell × R_th`. Esto tiene múltiples problemas:

1. **No modela la degradación por temperatura**: Las celdas de litio pierden ciclo de vida exponencialmente con la temperatura. A 45°C un pack NMC pierde ~2× más capacidad que a 25°C
2. **No calcula la distribución de temperatura**: En un pack real, las celdas centrales están más calientes que las exteriores (thermal gradient)
3. **No tiene curvas de derating por temperatura**: La capacidad y corriente máxima cambian con la temperatura
4. **No estima thermal runaway propagation**: Si una celda entra en thermal runaway, ¿se propaga al pack?

### Gravedad de implementación: 🔴 ALTA (Safety-Critical)

### Pasos para implementar

1. **Crear módulo `thermal-engine.ts`**
   - Interface `ThermalConfig`: `tAmb`, `tMax`, `coolingType: 'none' | 'air' | 'liquid'`, `airflowCFM`, `coolantFlowLPM`
   - Interface `CellThermalResult`: `tCell`, `tMax`, `thermalGradient`, `deratingFactor`, `cycleLifeImpact`

2. **Implementar modelo de temperatura de celda**
   - Modelo de resistencia térmica simplificado: `T_cell = T_amb + (I² × R_internal × R_th) + (Q_busbar × R_th_busbar)`
   - Agregar factor de agrupamiento: celdas centrales reciben penalización de +5-15°C según número de celdas en paralelo
   - Implementar curvas de derating por temperatura:
     - NMC: 100% @ 25°C, 95% @ 35°C, 85% @ 45°C, 70% @ 55°C
     - LFP: 100% @ 25°C, 98% @ 35°C, 92% @ 45°C, 80% @ 55°C
     - LTO: 100% @ 25°C, 99% @ 35°C, 95% @ 45°C, 88% @ 55°C

3. **Implementar estimación de ciclo de vida**
   - Usar modelo de Arrhenius simplificado: `n_cycles = n_ref × exp(Ea/R × (1/T_ref - 1/T_operating))`
   - Para NMC: Ea ≈ 24.6 kJ/mol, n_ref = 500 ciclos a 25°C, 1C
   - Para LFP: Ea ≈ 20.0 kJ/mol, n_ref = 2000 ciclos a 25°C, 1C
   - Mostrar estimación de "Estimated Pack Life" en el panel

4. **Crear UI `ThermalSection.astro`**
   - Inputs: temperatura ambiente, tipo de refrigeración, airflow (CFM si air-cooled), temperatura máxima de operación
   - Outputs: temperatura estimada de celda, factor de derating, ciclo de vida estimado
   - Semaforo: 🟢 < 40°C / 🟡 40-55°C / 🔴 > 55°C
   - Warning si ciclo de vida estimado < 500 ciclos

5. **Integrar con safety indicators**
   - Modificar `checkJouleHeat()` para usar el nuevo motor térmico
   - El factor de derating debe afectar los límites de corriente del pack

### Archivos afectados
- Nuevo: `src/scripts/thermal-engine.ts`
- Nuevo: `src/components/sidebar/ThermalSection.astro`
- Modificar: `src/scripts/diagnostic.ts` (usar thermal engine)
- Modificar: `src/scripts/safety-indicators.ts` (derating por temperatura)
- Modificar: `src/scripts/datasheet.ts` (agregar thermal data al PDF)

---

## F3 — Sistema de Refrigeración del Pack (Cooling System Design)

### Por qué es crítica
**No existe ningún módulo de diseño de refrigeración.** Para packs profesionales (>500W de disipación o >20Ah), la refrigeración no es opcional — es un requisito de seguridad y rendimiento.

Un pack sin refrigeración adecuada puede:
- Reducir drásticamente la vida útil (2-5× menos ciclos)
- Crear hotspots que causan degradación desigual entre celdas
- En casos extremos, provocar thermal runaway

### Gravedad de implementación: 🔴 ALTA (Safety-Critical)

### Pasos para implementar

1. **Crear módulo `cooling-engine.ts`**
   - Interface `CoolingDesign`: `type: 'passive' | 'air' | 'liquid'`, `fanSpec`, `pumpSpec`, `radiatorSpec`, `timMaterial`
   - Interface `CoolingResult`: `tCellMax`, `tCellMin`, `thermalGradient`, `coolingCapacityW`, `powerConsumptionW`

2. **Implementar cálculo de disipación de calor**
   - `Q_total = I² × R_internal_total + I² × R_busbar_total + I² × R_cable_total`
   - Actualmente el tool calcula `heatTotal` pero no lo usa para sizing de refrigeración

3. **Implementar modelos de refrigeración**
   - **Passive (sin cooling)**: Convección natural, h ≈ 5-10 W/m²K. Solo para packs < 50W
   - **Air cooling**: Convección forzada, h ≈ 25-100 W/m²K. Calcular CFM necesario basado en: `Q = m_dot × Cp × ΔT`
   - **Liquid cooling**: Circuito de enfriamiento con coolant, h ≈ 200-1000 W/m²K. Calcular flow rate: `Q = ρ × Cp × V_dot × ΔT`

4. **Crear Thermal Interface Material (TIM) database**
   - Base de datos de materiales: Thermal paste, thermal pads, gap fillers
   - Campos: `thermalConductivity_W_mK`, `thickness_mm`, `maxTemp_C`, `compressiveStrength_kPa`
   - Recomendar TIM según gap entre celdas y disipador/chasis

5. **Crear UI `CoolingSection.astro`**
   - Tipo de refrigeración: None / Air / Liquid
   - Para air: número de fans, CFM por fan, dirección de airflow
   - Para liquid: tipo de coolant (water/glycol 50/50), flow rate, radiator size
   - Output: temperatura estimada, eficiencia del cooling, consumo de energía del sistema de cooling

6. **Agregar al BOM**
   - Incluir fans/radiador/pump/tubing en el Bill of Materials
   - Costo estimado del sistema de refrigeración

### Archivos afectados
- Nuevo: `src/scripts/cooling-engine.ts`
- Nuevo: `src/components/sidebar/CoolingSection.astro`
- Nuevo: `src/scripts/tim-database.ts`
- Modificar: `src/scripts/pack-builder.ts` (renderizar elementos de cooling en 3D)
- Modificar: `src/scripts/datasheet.ts` (agregar cooling data)

---

## F4 — Encapsulado del Pack (Pack Enclosure Design)

### Por qué es crítica
**No existe diseño de encapsulado (enclosure/case).** Un pack de baterías profesional necesita:
- Protección IP (ingress protection contra polvo y agua)
- Protección mecánica contra impactos
- Aislamiento eléctrico
- Montaje y fijación al vehículo/chasis
- Ventilación o sellado según aplicación
- Cumplimiento de normas de seguridad

El tool actual solo muestra las celdas "al aire" sin considerar el enclosure.

### Gravedad de implementación: 🟡 MEDIA-ALTA

### Pasos para implementar

1. **Crear módulo `enclosure-engine.ts`**
   - Interface `EnclosureConfig`: `material`, `ipRating`, `wallThickness_mm`, `mountingType`, `ventType`, `gasketMaterial`
   - Interface `EnclosureResult`: `dimensions`, `weight`, `volume`, `ipRatingAchieved`, `thermalResistance`

2. **Definir tipos de encapsulado**
   - **Aluminum**: Liviano, buen disipador de calor, EMI shielding. Para EV, drones, e-bikes
   - **Steel (powder coated)**: Más barato, más pesado, good for stationary
   - **Plastic (ABS/PC)**: Aislamiento eléctrico, liviano, para consumer electronics
   - **FR4/Fiberglass**: Aislamiento eléctrico excelente, para high-voltage

3. **Implementar cálculo de dimensiones del enclosure**
   - Pack dimensions actuales + clearance (5-10mm por lado para airflow/TIM)
   - Wall thickness según material y IP rating
   - Mounting holes / brackets
   - Conector panel cuts

4. **Definir IP Rating requirements**
   - IP20: Indoor use (powerwall, stationary)
   - IP54: Protected against dust and water splashes (e-bike, general EV)
   - IP65: Protected against water jets (marine, outdoor)
   - IP67: Submersible (underwater, extreme environments)
   - IP68: Permanent submersion

5. **Crear UI `EnclosureSection.astro`**
   - Material selector con propiedades (conductividad, peso, costo, IP max)
   - IP rating selector con requisitos visuales
   - Thickness input con warning de weight/volume
   - Mounting options: brackets, rails, custom
   - Output: dimensiones finales, peso del enclosure, costo estimado

6. **Renderizar en 3D**
   - Agregar prisma translúcido del enclosure alrededor del pack en Three.js
   - Mostrar mounting holes y connector panel
   - Toggle de visibilidad del enclosure

### Archivos afectados
- Nuevo: `src/scripts/enclosure-engine.ts`
- Nuevo: `src/components/sidebar/EnclosureSection.astro`
- Modificar: `src/scripts/pack-builder.ts` (renderizar enclosure en 3D)
- Modificar: `src/scripts/datasheet.ts` (agregar enclosure specs)
- Modificar: `src/scripts/stl-export.ts` (exportar enclosure)

---

## F5 — Motor de Recomendación de Breakers y Disconnects (Breaker & Disconnect Engine)

### Por qué es crítica
El tool actual solo recomienda **fusibles** (ANL, MIDI, Class-T). Pero para packs profesionales, los fusibles **no son suficientes**. Se necesitan:

- **Cortacircuitos (Circuit Breakers)**: Para aplicación manual de desconexión, protección contra sobrecarga
- **Contactors**: Para control remoto del pack (on/off desde BMS o interruptor)
- **Precharge circuits**: Para evitar daño a MOSFETs del BMS al conectar cargas capacitivas
- **Disconnect switches**: Para maintenance safety (LOTO - Lock Out/Tag Out)
- **High Voltage Interlock Loop (HVIL)**: Para detección de conexión/desconexión segura

Un pack de 72V 200Ah sin contactor adecuado puede causar **arco eléctrico mortal** al desconectar bajo carga.

### Gravedad de implementación: 🔴 ALTA (Safety-Critical)

### Pasos para implementar

1. **Crear módulo `breaker-engine.ts`**
   - Interface `BreakerConfig`: `type: 'breaker' | 'contactor' | 'disconnect' | 'precharge'`, `ratingA`, `voltageMax`, `poles`, `mounting`
   - Interface `BreakerRecommendation`: `component`, `ratingA`, `voltageMax`, `reason`, `safetyNotes`

2. **Definir reglas de selección**
   - **Breaker**: Para pack < 60V, < 200A. Seleccionar por: `ratingA ≥ I_max × 1.25`, `voltageMax ≥ V_pack × 1.1`
   - **Contactor**: Para pack > 60V o > 200A. Coil voltage = V_pack (si > 12V) o 12V aux. Rating ≥ I_max × 1.5
   - **Disconnect switch**: Para maintenance. Rating ≥ I_max × 2.0 (interrupt capacity)
   - **Precharge circuit**: Para pack > 48V. Resistor: `R = V_pack / (I_inrush × k_factor)` donde k_factor ≈ 3-5
   - **HVIL**: Para pack > 60V. Loop resistance < 100Ω, monitoring voltage divider

3. **Crear base de datos de componentes**
   - Contactors: Tyco/KV, TE Connectivity, Panasonic
   - Breakers: Square D, Siemens, ABB
   - Disconnects: Blue Sea Systems, Marinco
   - Precharge resistors: Vishay, Caddock

4. **Crear UI `BreakerSection.astro`**
   - Tipo de aplicación: E-bike / Powerwall / EV / Drone / Marine
   - Inputs automáticos: V_pack, I_max, application
   - Outputs: componentes recomendados con especificaciones
   - Warning si no hay protección adecuada
   - Diagrama de conexión del breaker/contactor

5. **Renderizar en 3D**
   - Posicionar breaker/contactor como componente en el pack
   - Mostrar ubicación de montaje

### Archivos afectados
- Nuevo: `src/scripts/breaker-engine.ts`
- Nuevo: `src/scripts/component-database.ts`
- Nuevo: `src/components/sidebar/BreakerSection.astro`
- Modificar: `src/scripts/datasheet.ts` (agregar breaker specs)
- Modificar: `src/scripts/power-connector-engine.ts` (integrar con connector recommendations)

---

## F6 — Análisis de Balanceo de Celdas (Cell Balancing Analysis)

### Por qué es crítica
El tool actual tiene un BMS selector que indica tipo de balance (pasivo/activo), pero **no simula el efecto del desbalanceo de celdas** en el rendimiento del pack. En la realidad:

- Las celdas no son idénticas (tolerancia de fabricación ±2-5% en capacidad y resistencia interna)
- Con el tiempo, las celdas se desbalancean (diferencias de auto-descarga, temperatura)
- Un desbalanceo de 5-10% puede reducir la capacidad útil del pack en 15-20%
- El BMS de balanceo activo puede recuperar el 3-5% de capacidad perdida

### Gravedad de implementación: 🟡 MEDIA

### Pasos para implementar

1. **Crear módulo `balancing-engine.ts`**
   - Interface `CellImbalance`: `capacitySpread_pct`, `irSpread_pct`, `selfDischargeRate_pct_per_month`
   - Interface `BalancingResult`: `usableCapacity_pct`, `imbalanceImpact_pct`, `balancingTime_h`, `energyLost_W`

2. **Implementar simulación de desbalanceo**
   - Modelar celdas con distribución gaussiana de capacidad (μ = rated, σ = tolerance)
   - Simular descarga hasta que la celda más débil alcance LVC → pack apagado
   - Calcular capacidad real vs teórica
   - Para balanceo pasivo: resistencia de balanceo disipa energía de celdas altas
   - Para balanceo activo: transfiriendo energía entre celdas

3. **Implementar cálculo de tiempo de balanceo**
   - Balanceo pasivo: `t = (ΔV × C_cell) / I_balance` donde I_balance ≈ 50-100mA
   - Balanceo activo: `t = (ΔV × C_cell) / I_balance` donde I_balance ≈ 2-5A

4. **Crear UI `BalancingSection.astro`**
   - Input: tolerancia de celdas (±% que el usuario puede ajustar)
   - Output: capacidad real vs teórica, tiempo de balanceo, energía perdida
   - Comparación: balanceo pasivo vs activo
   - Suggestion: "Para packs >50Ah, se recomienda balanceo activo"

### Archivos afectados
- Nuevo: `src/scripts/balancing-engine.ts`
- Nuevo: `src/components/sidebar/BalancingSection.astro`
- Modificar: `src/scripts/bms-database.ts` (agregar más datos de balanceo)
- Modificar: `src/scripts/datasheet.ts` (agregar balancing data)

---

## F7 — Análisis de Degradación y Ciclo de Vida (Degradation & Cycle Life)

### Por qué es crítica
El tool actual no tiene **ninguna estimación de vida útil del pack**. Para un usuario profesional, saber que un pack durará 3 años o 10 años es fundamental para:
- Cálculo de costo total de propiedad (TCO)
- Decisiones de diseño ( ¿usar LFP para más ciclos o NMC para más energía? )
- Mantenimiento preventivo
- Garantías y SLA

### Gravedad de implementación: 🟡 MEDIA

### Pasos para implementar

1. **Crear módulo `degradation-engine.ts`**
   - Interface `DegradationConfig`: `chemistry`, `tempOperating`, `crateAvg`, `dodAvg`, `cycleCountTarget`
   - Interface `DegradationResult`: `capacityFade_pct_per_cycle`, `estimatedCycles_to_80pct`, `calendarLife_years`, `costPerCycle`

2. **Implementar modelo de degradación simplificado**
   - **Capacity fade por ciclo**: `ΔQ = k₁ × n^0.5` (modelo de raíz cuadrada, estándar en la industria)
   - **Efecto de temperatura**: Factor de Arrhenius `exp(Ea/R × (1/T_ref - 1/T))`
   - **Efecto de C-rate**: `k₁ = k₁_base × (C_avg / C_ref)^α` donde α ≈ 0.3-0.5
   - **Efecto de DoD**: `k₁ = k₁_base × (DoD)^β` donde β ≈ 0.5-0.7

3. **Valores de referencia por química**
   - NMC: k₁ ≈ 0.02% per √cycle @ 25°C, 1C, 80% DoD → ~500 ciclos al 80%
   - LFP: k₁ ≈ 0.005% per √cycle @ 25°C, 1C, 80% DoD → ~3000 ciclos al 80%
   - LTO: k₁ ≈ 0.002% per √cycle @ 25°C, 1C, 80% DoD → ~8000 ciclos al 80%
   - Na-Ion: k₁ ≈ 0.01% per √cycle @ 25°C, 1C, 80% DoD → ~1000 ciclos al 80%

4. **Crear UI `DegradationSection.astro`**
   - Inputs: C-rate promedio, DoD promedio, temperatura de operación, ciclos objetivo
   - Output: capacity fade curve (gráfica simple), ciclos al 80%, costo por ciclo
   - Comparación entre químicas: "Para 2000 ciclos, LFP es 3× más barato que NMC"
   - Warning si se proyecta degradación > 20% en el tiempo de vida esperado

### Archivos afectados
- Nuevo: `src/scripts/degradation-engine.ts`
- Nuevo: `src/components/sidebar/DegradationSection.astro`
- Modificar: `src/scripts/datasheet.ts` (agregar cycle life data)

---

## F8 — Diseño de Circuito de Precharge (Precharge Circuit Design)

### Por qué es crítica
Para packs >48V que alimentan inversores o cargas capacitivas, **conectar directamente el pack sin precharge causa un pico de corriente** que puede:
- Dañar contactores (soldadura de contactos)
- Dañar MOSFETs del BMS
- Causar arco eléctrico peligroso
- Dañar capacitores de entrada del inversor

El pico de corriente puede ser **10-50× la corriente nominal** durante los primeros milisegundos.

### Gravedad de implementación: 🔴 ALTA (Safety-Critical para packs >48V)

### Pasos para implementar

1. **Crear módulo `precharge-engine.ts`**
   - Interface `PrechargeConfig`: `packVoltage`, `loadCapacitance`, `contactorResistance`, `prechargeTimeTarget_ms`
   - Interface `PrechargeResult`: `resistorOhm`, `resistorWattage`, `prechargeTime_ms`, `maxInrushA`

2. **Implementar cálculo de precharge**
   - Circuito RC: `V(t) = V_pack × (1 - e^(-t/RC))`
   - Precharge time: `t = -R × C × ln(1 - V_target/V_pack)` donde V_target = 95% de V_pack
   - Resistor power: `P = V_pack² / R` durante precharge, luego `P = I_leak² × R` en estado estacionario
   - Safety margin: R ≤ V_pack / (10 × I_nominal)

3. **Crear UI `PrechargeSection.astro`**
   - Inputs: capacitancia de carga estimada (default 1000µF para inversores, 100µF para cargas simples)
   - Target precharge time (default 500ms para contactores)
   - Output: resistor value, power rating, precharge time estimado
   - Diagrama simplificado del circuito de precharge

4. **Agregar al BOM**
   - Incluir resistor de precharge en el Bill of Materials
   - Nota: "Precharge resistor required for packs >48V with contactors"

### Archivos afectados
- Nuevo: `src/scripts/precharge-engine.ts`
- Nuevo: `src/components/sidebar/PrechargeSection.astro`
- Modificar: `src/scripts/breaker-engine.ts` (integrar precharge con contactors)
- Modificar: `src/scripts/datasheet.ts` (agregar precharge specs)

---

## F9 — Análisis de Corriente en Paralelo (Parallel String Current Sharing)

### Por qué es crítica
Cuando se usan múltiples strings en paralelo (P > 1), **la corriente no se distribuye uniformemente** entre los strings debido a:
- Diferencias de resistencia interna entre celdas
- Diferencias de temperatura entre strings
- Diferencias de longitud de cable/busbar
- Diferencias de resistencia de contacto

Un desbalanceo de 10% puede causar que un string opere al 110% de su capacidad mientras otro opera al 90%, reduciendo la vida útil y creando un punto de falla.

### Gravedad de implementación: 🟡 MEDIA

### Pasos para implementar

1. **Crear módulo `current-sharing-engine.ts`**
   - Interface `StringImbalance`: `resistanceSpread_pct`, `tempSpread_C`, `cableLengthSpread_mm`
   - Interface `SharingResult`: `maxStringCurrent`, `minStringCurrent`, `imbalance_pct`, `hotspotRisk`

2. **Implementar cálculo de distribución de corriente**
   - Modelo: `I_string = V_pack / (R_string + R_cable + R_contact)`
   - Para P strings: `I_total = Σ(I_string_i)`
   - Balance factor: `BF = I_max / I_avg` donde BF理想的 = 1.0, BF aceptable ≤ 1.1

3. **Crear UI `CurrentSharingSection.astro`**
   - Inputs: tolerancia de resistencia (±%), diferencia de temperatura (°C), diferencia de longitud de cable (mm)
   - Output: factor de desbalanceo, corriente máxima/mínima por string
   - Warning si BF > 1.1: "Consider adding equalization resistors or active current sharing"

### Archivos afectados
- Nuevo: `src/scripts/current-sharing-engine.ts`
- Nuevo: `src/components/sidebar/CurrentSharingSection.astro`

---

## F10 — Análisis de Costo Total (Total Cost of Ownership)

### Por qué es crítica
El tool actual muestra costo de celdas pero **no calcula costo total de operación**. Para un usuario profesional, saber que un pack NMC cuesta €500 pero dura 3 años, mientras que un pack LFP cuesta €800 pero dura 8 años, es fundamental para la toma de decisiones.

### Gravedad de implementación: 🟡 MEDIA-BAJA

### Pasos para implementar

1. **Crear módulo `cost-engine.ts`**
   - Interface `CostConfig`: `cellCost`, `bmsCost`, `connectorCost`, `enclosureCost`, `coolingCost`, `assemblyCost`
   - Interface `CostResult`: `totalUpfront`, `costPerKWh`, `costPerCycle`, `costPerYear`, `tco_5yr`, `tco_10yr`

2. **Implementar cálculo de TCO**
   - Costo de energía: `E_annual = Wh × cycles_per_year × 365 / 1000`
   - Costo de reemplazo: `replacement_cost = pack_cost × (years / pack_life_years)`
   - TCO = `upfront_cost + (energy_cost × years) + maintenance + replacement`

3. **Crear UI `CostSection.astro`**
   - Inputs: costo de electricidad (€/kWh), ciclos por año, años de vida, costo de mantenimiento
   - Output: TCO por año, comparación con alternativas
   - Gráfica simple de payback period

### Archivos afectados
- Nuevo: `src/scripts/cost-engine.ts`
- Nuevo: `src/components/sidebar/CostSection.astro`
- Modificar: `src/scripts/datasheet.ts` (agregar cost analysis)

---

## F11 — Integración con IoT y Monitoreo en Tiempo Real (IoT Integration)

### Por qué es crítica
Los packs profesionales modernos requieren **monitoreo remoto** para:
- Predicción de fallas (predictive maintenance)
- Optimización de carga/descarga
- Alertas de seguridad en tiempo real
- Logging de datos para auditoría

### Gravedad de implementación: 🟢 BAJA (Nice-to-have, no safety-critical)

### Pasos para implementar

1. **Crear módulo `iot-integration.ts`**
   - Interface `IoTConfig`: `protocol: 'mqtt' | 'modbus' | 'can'`, `sampleRate_s`, `dataPoints[]`
   - Interface `IoTDataPoint`: `name`, `unit`, `min`, `max`, `alarmThreshold`

2. **Generar configuración de monitoreo**
   - Basado en la configuración del pack, generar lista de datapoints a monitorear
   - Por pack: V_pack, I_pack, T_cell_avg, T_cell_max, SoC, SoH, balance_status
   - Configurar alarmas: overvoltage, overcurrent, overtemperature, undervoltage

3. **Exportar configuración**
   - Generar JSON de configuración para sistemas de monitoreo (Home Assistant, Grafana, ThingsBoard)
   - Generar CSV de datapoints para data logging

### Archivos afectados
- Nuevo: `src/scripts/iot-integration.ts`
- Nuevo: `src/components/modals/IoTConfigModal.astro`

---

## F12 — Mejoras UI/UX (UI/UX Improvements)

### Por qué es crítica
El UI actual es funcional pero tiene problemas de usabilidad para usuarios profesionales:
- Demasiadas secciones colapsables que dificultan el flujo de trabajo
- No hay guía de usuario contextual
- No hay validación visual en tiempo real de inputs
- No hay modo oscuro (importante para uso en taller con poca luz)
- No hay atajos de teclado
- No hay undo/redo
- No hay save/load de configuraciones

### Gravedad de implementación: 🟡 MEDIA

### Pasos para implementar

1. **Guía de usuario contextual (Onboarding)**
   - Tour guiado de 5 pasos al primer uso
   - Tooltips contextuales en cada sección
   - "Quick start" wizard para configuración básica

2. **Validación visual de inputs**
   - Bordes verdes/rojos en inputs según validación
   - Mensajes de error inline
   - Tooltips con rango válido

3. **Modo oscuro**
   - Theme toggle en el header
   - Persistencia en localStorage
   - Colores optimizados para legibilidad

4. **Atajos de teclado**
   - `Ctrl+Z` / `Ctrl+Y`: Undo/Redo
   - `Ctrl+S`: Guardar configuración
   - `Ctrl+E`: Exportar
   - `Ctrl+1-9`: Jump to section

5. **Save/Load de configuraciones**
   - Guardar configuración completa como JSON
   - Cargar configuración previa
   - Share configuration via URL (query params)

6. **Responsive design mejorado**
   - Sidebar colapsable en mobile
   - Touch-friendly inputs
   - Optimización para tablets (uso en taller)

### Archivos afectados
- Modificar: `src/pages/index.astro`
- Modificar: `src/scripts/ui.ts`
- Modificar: `src/components/Header.astro`
- Nuevo: `src/scripts/keyboard-shortcuts.ts`
- Nuevo: `src/scripts/config-storage.ts`
- Nuevo: `src/components/OnboardingOverlay.astro`

---

## Resumen de Prioridades

| # | Feature | Gravedad | Esfuerzo | Impacto | Dependencias |
|---|---------|----------|----------|---------|--------------|
| F1 | Standards Compliance | 🔴 Alta | Alto | Crítico | Ninguna |
| F2 | Cell Thermal Engine | 🔴 Alta | Alto | Crítico | F3 |
| F3 | Cooling System Design | 🔴 Alta | Medio | Alto | F2 |
| F4 | Pack Enclosure Design | 🟡 Media-Alta | Medio | Alto | F3 |
| F5 | Breaker & Disconnect Engine | 🔴 Alta | Medio | Crítico | Ninguna |
| F6 | Cell Balancing Analysis | 🟡 Media | Bajo | Medio | Ninguna |
| F7 | Degradation & Cycle Life | 🟡 Media | Medio | Alto | F2 |
| F8 | Precharge Circuit Design | 🔴 Alta | Bajo | Alto | F5 |
| F9 | Parallel String Current Sharing | 🟡 Media | Bajo | Medio | Ninguna |
| F10 | Total Cost of Ownership | 🟡 Media-Baja | Bajo | Medio | F7 |
| F11 | IoT Integration | 🟢 Baja | Alto | Bajo | Ninguna |
| F12 | UI/UX Improvements | 🟡 Media | Medio | Alto | Ninguna |

---

## Orden de Implementación Sugerido

### Fase 1 — Safety-Critical (Sprint 1-2)
1. **F5** — Breaker & Disconnect Engine (fundamental para seguridad)
2. **F8** — Precharge Circuit Design (requiere F5)
3. **F1** — Standards Compliance (requiere F5 y F8 como input)
4. **F2** — Cell Thermal Engine (base para F3 y F7)

### Fase 2 — Thermal & Mechanical (Sprint 3-4)
5. **F3** — Cooling System Design (requiere F2)
6. **F4** — Pack Enclosure Design (requiere F3)
7. **F7** — Degradation & Cycle Life (requiere F2)

### Fase 3 — Analysis & Optimization (Sprint 5-6)
8. **F6** — Cell Balancing Analysis
9. **F9** — Parallel String Current Sharing
10. **F10** — Total Cost of Ownership (requiere F7)

### Fase 4 — UX & Integration (Sprint 7-8)
11. **F12** — UI/UX Improvements
12. **F11** — IoT Integration

---

## Notas para el Equipo de Desarrollo

1. **Cada feature debe incluir tests unitarios** para las fórmulas de cálculo. Las fórmulas térmicas y eléctricas son verificables contra datasheets de fabricantes.

2. **Usar valores de referencia reales**: Las constantes de Arrhenius, los factores de degradación, y los ratings de componentes deben venir de papers peer-reviewed o datasheets de fabricantes (Samsung SDI, LG Energy Solution, CATL, etc.)

3. **Priorizar la safety**: Si una feature mejora la seguridad del pack (F1, F2, F3, F5, F8), debe implementarse antes que features de conveniencia.

4. **Mantener la modularidad**: Cada engine debe ser un módulo independiente que pueda ser testado y mantenido separadamente.

5. **Documentar las fórmulas**: Cada cálculo en el código debe tener un comentario que referencie la fuente de la fórmula (paper, estándar, o datasheet).

---

*Este documento debe actualizarse conforme se implementen las features o se descubran nuevos requisitos.*
