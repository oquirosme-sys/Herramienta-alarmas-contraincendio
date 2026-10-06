-- Semilla del catálogo — generada desde js/catalogo-base.js (hojas BD_* de Cálculo_baterías_Alarmas.xlsx).
-- Re-ejecutable: no sobrescribe registros que ya existan (on conflict do nothing).
-- Alternativa: desde la app, Administración → Respaldo → «Restablecer catálogo base».
begin;

insert into public.fabricantes (id, nombre, orden) values
  ('simplex', 'SIMPLEX', 0),
  ('notifier', 'NOTIFIER', 1),
  ('siemens', 'SIEMENS', 2),
  ('generico', 'GENÉRICO', 3)
on conflict (id) do nothing;

insert into public.dispositivos (id, fabricante_id, modelo, tag, tipo, descripcion, i_espera_ma, i_alarma_ma, circuito, obs, orden) values
  ('d01', 'simplex', '4100ES', 'FACP', 'Panel de control (FACP)', 'PANEL PRINCIPAL 4100ES (CPU + fuente básica)', 425, 735, 'SISTEMA', 'Ficha 4100ES S4100-0031. Verificar según módulos instalados', 0),
  ('d02', 'simplex', '4100-9600', 'TRP', 'Transponder', 'TRANSPONDER MODO LOCAL', 425, 735, 'SISTEMA', 'Ficha transponder 4100ES. Verificar configuración', 1),
  ('d03', 'simplex', '4010ES', 'FACP', 'Panel de control (FACP)', 'PANEL 4010ES (CPU + fuente básica)', 250, 425, 'SISTEMA', 'Ficha S4010-0004. Verificar módulos', 2),
  ('d04', 'simplex', '4098-9714', 'SDH', 'Detector de humo', 'DETECTOR HUMO FOTOELÉCTRICO TrueAlarm (IDNet)', 0.8, 1, 'SLC', 'Ficha S4098-0019', 3),
  ('d05', 'simplex', '4098-9733', 'SDT', 'Detector térmico', 'DETECTOR TÉRMICO TrueAlarm (IDNet)', 0.8, 1, 'SLC', 'Ficha S4098-0019', 4),
  ('d06', 'simplex', '4098-9755', 'SD-DUCTO', 'Detector de humo de ducto', 'SENSOR DE HUMO EN DUCTO (IDNet)', 0.8, 1, 'SLC', 'Ficha S4098-0024', 5),
  ('d07', 'simplex', '4098-9770', 'CO', 'Detector de CO', 'BASE + SENSOR CO', 0.8, 1, 'SLC', 'Verificar ficha; base sonora suma consumo NAC', 6),
  ('d08', 'simplex', '4099-9003', 'EM', 'Estación manual', 'ESTACIÓN MANUAL DIRECCIONABLE', 0.8, 1, 'SLC', 'Ficha S4099-0006', 7),
  ('d09', 'simplex', '4090-9001', 'AIM', 'Módulo de monitoreo', 'MÓDULO DE MONITOREO IDNet', 0.8, 1, 'SLC', 'Ficha S4090-0011', 8),
  ('d10', 'simplex', '4090-9002', 'AOM', 'Módulo de control (salida)', 'MÓDULO RELAY IDNet', 8, 5, 'SLC', 'Valor histórico Sinergia; verificar S4090-0011', 9),
  ('d11', 'simplex', '4090-9101', 'ZAM', 'Módulo de zona', 'MÓDULO ADAPTADOR DE ZONA', 8, 5, 'SLC', 'Verificar ficha S4090-0012', 10),
  ('d12', 'simplex', '4090-9116', 'ISO', 'Aislador de lazo', 'MÓDULO/BASE AISLADOR DE LAZO', 0.5, 0.5, 'SLC', 'Verificar ficha', 11),
  ('d13', 'simplex', '4906-9151', 'ST-P 15cd', 'Estrobo de pared', 'ESTROBO PARED TrueAlert 15 cd', 0, 59, 'NAC', 'Ficha S4906-0004 (regulado 16–33 V)', 12),
  ('d14', 'simplex', '4906-9151', 'ST-P 30cd', 'Estrobo de pared', 'ESTROBO PARED TrueAlert 30 cd', 0, 67, 'NAC', 'Ficha S4906-0004', 13),
  ('d15', 'simplex', '4906-9151', 'ST-P 75cd', 'Estrobo de pared', 'ESTROBO PARED TrueAlert 75 cd', 0, 107, 'NAC', 'Ficha S4906-0004', 14),
  ('d16', 'simplex', '4906-9151', 'ST-P 110cd', 'Estrobo de pared', 'ESTROBO PARED TrueAlert 110 cd', 0, 139, 'NAC', 'Ficha S4906-0004', 15),
  ('d17', 'simplex', '4906-9151', 'ST-P 135cd', 'Estrobo de pared', 'ESTROBO PARED TrueAlert 135 cd', 0, 166, 'NAC', 'Ficha S4906-0004', 16),
  ('d18', 'simplex', '4906-9154', 'ST-C 15cd', 'Estrobo de cielo', 'ESTROBO CIELO TrueAlert 15 cd', 0, 59, 'NAC', 'Ficha S4906-0004', 17),
  ('d19', 'simplex', '4906-9154', 'ST-C 30cd', 'Estrobo de cielo', 'ESTROBO CIELO TrueAlert 30 cd', 0, 67, 'NAC', 'Ficha S4906-0004', 18),
  ('d20', 'simplex', '4906-9154', 'ST-C 75cd', 'Estrobo de cielo', 'ESTROBO CIELO TrueAlert 75 cd', 0, 107, 'NAC', 'Ficha S4906-0004', 19),
  ('d21', 'simplex', '4906-9127', 'AV-P 15cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED 15 cd', 0, 74, 'NAC', 'Ficha S4906-0002', 20),
  ('d22', 'simplex', '4906-9127', 'AV-P 30cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED 30 cd', 0, 84, 'NAC', 'Ficha S4906-0002', 21),
  ('d23', 'simplex', '4906-9127', 'AV-P 75cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED 75 cd', 0, 140, 'NAC', 'Ficha S4906-0002', 22),
  ('d24', 'simplex', '4906-9127', 'AV-P 110cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED 110 cd', 0, 185, 'NAC', 'Ficha S4906-0002', 23),
  ('d25', 'simplex', '4902-9717', 'SPK', 'Parlante', 'PARLANTE HABITACIÓN (tap 1 W @25/70.7V)', 0, 10, 'VOCEO', 'Corriente ref. en 24V equiv.; potencia real por tap en amplificador', 24),
  ('d26', 'simplex', '4904-9168', 'ST-WRF', 'Estrobo direccionable (IDNAC)', 'ESTROBO PARED 49VO-WRF direccionable', 0, 60, 'IDNAC', 'Verificar ficha 49 Series por candela', 25),
  ('d27', 'simplex', '2081-9044', 'EOL', 'Resistencia fin de línea', 'RESISTENCIA FIN DE LÍNEA SLC/NAC', 0, 0, 'NAC', 'Sin consumo supervisión DC apreciable', 26),
  ('d28', 'simplex', 'BASE SONORA', 'SB', 'Base sonora', 'DETECTOR + BASE SONORA (habitaciones)', 1, 130, 'FUENTE AUX', 'Valor histórico Sinergia. Verificar ficha de base sonora usada', 27),
  ('d29', 'notifier', 'NFS2-3030', 'FACP', 'Panel de control (FACP)', 'PANEL NFS2-3030 (CPU-3030 + display)', 210, 375, 'SISTEMA', 'Ficha DN-7080. Sumar lazos LCM/LEM y fuente', 28),
  ('d30', 'notifier', 'NFS-320', 'FACP', 'Panel de control (FACP)', 'PANEL NFS-320', 120, 220, 'SISTEMA', 'Ficha DN-7112. Verificar accesorios', 29),
  ('d31', 'notifier', 'FSP-951', 'SDH', 'Detector de humo', 'DETECTOR HUMO FOTOELÉCTRICO FlashScan', 0.3, 6.5, 'SLC', 'Ficha DN-60735; LED alarma', 30),
  ('d32', 'notifier', 'FST-951', 'SDT', 'Detector térmico', 'DETECTOR TÉRMICO FlashScan', 0.3, 6.5, 'SLC', 'Ficha DN-60737', 31),
  ('d33', 'notifier', 'DNR + FSP-951R', 'SD-DUCTO', 'Detector de humo de ducto', 'DETECTOR DE HUMO EN DUCTO', 0.3, 6.5, 'SLC', 'Ficha DN-60054', 32),
  ('d34', 'notifier', 'NBG-12LX', 'EM', 'Estación manual', 'ESTACIÓN MANUAL DIRECCIONABLE', 0.23, 5, 'SLC', 'Ficha DN-6726', 33),
  ('d35', 'notifier', 'FMM-1', 'AIM', 'Módulo de monitoreo', 'MÓDULO DE MONITOREO', 0.375, 5, 'SLC', 'Ficha DN-6720', 34),
  ('d36', 'notifier', 'FZM-1', 'ZAM', 'Módulo de zona', 'MÓDULO INTERFAZ ZONA CONVENCIONAL', 0.3, 5, 'SLC', 'Ficha DN-6720; sumar consumo zona en 24V', 35),
  ('d37', 'notifier', 'FCM-1', 'AOM', 'Módulo de control (salida)', 'MÓDULO DE CONTROL', 0.35, 6.5, 'SLC', 'Ficha DN-6720', 36),
  ('d38', 'notifier', 'FRM-1', 'RLY', 'Módulo relay', 'MÓDULO RELAY', 0.23, 6.5, 'SLC', 'Ficha DN-6720', 37),
  ('d39', 'notifier', 'ISO-X', 'ISO', 'Aislador de lazo', 'MÓDULO AISLADOR DE LAZO', 0.45, 0.45, 'SLC', 'Ficha DN-6994', 38),
  ('d40', 'notifier', 'WFD (+FMM-1)', 'WF', 'Interruptor de flujo', 'INTERRUPTOR DE FLUJO (vía módulo monitor)', 0, 0, 'IDC', 'Contacto seco; consumo lo aporta el FMM-1', 39),
  ('d41', 'notifier', 'PIBV2', 'VS', 'Supervisor de válvula', 'SUPERVISOR VÁLVULA (vía módulo monitor)', 0, 0, 'IDC', 'Contacto seco; consumo lo aporta el FMM-1', 40),
  ('d42', 'notifier', 'SR 15cd', 'ST-P 15cd', 'Estrobo de pared', 'ESTROBO PARED SpectrAlert Advance 15 cd', 0, 64, 'NAC', 'Ficha System Sensor S-SR; verificar por sincronización', 41),
  ('d43', 'notifier', 'SR 30cd', 'ST-P 30cd', 'Estrobo de pared', 'ESTROBO PARED SpectrAlert Advance 30 cd', 0, 80, 'NAC', 'Ficha S-SR', 42),
  ('d44', 'notifier', 'SR 75cd', 'ST-P 75cd', 'Estrobo de pared', 'ESTROBO PARED SpectrAlert Advance 75 cd', 0, 127, 'NAC', 'Ficha S-SR', 43),
  ('d45', 'notifier', 'SR 110cd', 'ST-P 110cd', 'Estrobo de pared', 'ESTROBO PARED SpectrAlert Advance 110 cd', 0, 167, 'NAC', 'Ficha S-SR', 44),
  ('d46', 'notifier', 'P2R 15cd', 'AV-P 15cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED P2R 15 cd', 0, 101, 'NAC', 'Ficha S-P2R (bocina temporal alto dBA)', 45),
  ('d47', 'notifier', 'P2R 75cd', 'AV-P 75cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED P2R 75 cd', 0, 164, 'NAC', 'Ficha S-P2R', 46),
  ('d48', 'notifier', 'P2R 110cd', 'AV-P 110cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED P2R 110 cd', 0, 204, 'NAC', 'Ficha S-P2R', 47),
  ('d49', 'notifier', 'SPSR 15cd', 'SPK+ST 15cd', 'Parlante + estrobo de pared', 'PARLANTE+ESTROBO PARED SPSR 15 cd', 0, 64, 'NAC+VOCEO', 'Estrobo en NAC; potencia parlante por tap', 48),
  ('d50', 'notifier', 'SPSCR 15cd', 'SPK+ST-C 15cd', 'Parlante + estrobo de cielo', 'PARLANTE+ESTROBO CIELO SPSCR 15 cd', 0, 64, 'NAC+VOCEO', 'Ídem', 49),
  ('d51', 'notifier', 'FDU-80', 'ANN', 'Anunciador remoto', 'ANUNCIADOR REMOTO FDU-80', 40, 40, 'RED/24VDC', 'Ficha DN-6820', 50),
  ('d52', 'notifier', 'FCPS-24S8', 'RPS', 'Fuente de poder remota', 'FUENTE REMOTA 24VDC 8A', 145, 145, 'SISTEMA', 'Ficha DN-6927; consumo propio + cargador aparte', 51),
  ('d53', 'siemens', 'FC922/FC924', 'FACP', 'Panel de control (FACP)', 'PANEL CERBERUS PRO FC92x', 300, 500, 'SISTEMA', 'Ficha A6V10333558; verificar configuración', 52),
  ('d54', 'siemens', 'OP921', 'SDH', 'Detector de humo', 'DETECTOR HUMO FOTOELÉCTRICO', 0.3, 0.6, 'SLC', 'Ficha A6V10334396; LED alarma aparte', 53),
  ('d55', 'siemens', 'HI921', 'SDT', 'Detector térmico', 'DETECTOR TÉRMICO', 0.3, 0.6, 'SLC', 'Ficha A6V10334400', 54),
  ('d56', 'siemens', 'HMS-S', 'EM', 'Estación manual', 'ESTACIÓN MANUAL DIRECCIONABLE', 0.3, 0.6, 'SLC', 'Ficha A6V10334406', 55),
  ('d57', 'siemens', 'TRI-S', 'AIM', 'Módulo de monitoreo', 'MÓDULO DE MONITOREO 1 ENTRADA', 0.35, 0.55, 'SLC', 'Ficha A6V10334546', 56),
  ('d58', 'siemens', 'TRI-R', 'RLY', 'Módulo relay', 'MÓDULO RELAY', 0.35, 0.55, 'SLC', 'Ficha A6V10334546', 57),
  ('d59', 'siemens', 'ZW-MSI-10', 'ISO', 'Aislador de lazo', 'AISLADOR / INTERFAZ', 0.4, 0.4, 'SLC', 'Verificar ficha', 58),
  ('d60', 'siemens', 'SW-24 15cd', 'ST-P 15cd', 'Estrobo de pared', 'ESTROBO PARED 15 cd (línea SW)', 0, 68, 'NAC', 'Verificar ficha A6V vigente', 59),
  ('d61', 'siemens', 'SW-24 75cd', 'ST-P 75cd', 'Estrobo de pared', 'ESTROBO PARED 75 cd', 0, 130, 'NAC', 'Verificar ficha', 60),
  ('d62', 'siemens', 'HSW-24 15cd', 'AV-P 15cd', 'Bocina + estrobo de pared', 'BOCINA+ESTROBO PARED 15 cd', 0, 105, 'NAC', 'Verificar ficha', 61),
  ('d63', 'generico', '—', 'OTRO', 'Otro dispositivo', 'OTRO DISPOSITIVO (digitar corrientes manualmente)', 0, 0, '—', 'Editar corrientes en esta fila', 62)
on conflict (id) do nothing;

insert into public.cables (id, fabricante, modelo, awg, conductores, pantalla, listado, r_ohm_km, uso, obs, orden) values
  ('c01', 'BELDEN', '5020UL', 12, 2, 'NO', 'FPL', 5.2, 'NAC alta corriente', 'Ficha Belden 5020UL (1.60 Ω/1000 ft)', 0),
  ('c02', 'BELDEN', '5120UL', 14, 2, 'NO', 'FPL', 8.4, 'NAC', 'Ficha Belden 5120UL (2.55 Ω/1000 ft)', 1),
  ('c03', 'BELDEN', '5220UL', 16, 2, 'NO', 'FPLR', 13.5, 'SLC / IDC / NAC / 24VDC', 'Ficha Belden 5220UL (4.10 Ω/1000 ft). Estándar simbología Sinergia', 2),
  ('c04', 'BELDEN', '5320UL', 18, 2, 'NO', 'FPLR', 21, 'SLC corto', 'Ficha Belden 5320UL (6.40 Ω/1000 ft)', 3),
  ('c05', 'BELDEN', '5220FL', 16, 2, 'SÍ', 'FPLR', 13.5, 'VOCEO / RED COBRE', 'Ficha Belden 5220FL, par apantallado', 4),
  ('c06', 'BELDEN', '5222FL', 16, 4, 'SÍ', 'FPLR', 13.5, 'RED (datos+audio)', '4×16 AWG con pantalla, un par datos / un par audio', 5),
  ('c07', 'BELDEN', '9575', 16, 2, 'NO', 'FPL', 13.5, 'SLC', 'Ficha Belden 9575', 6),
  ('c08', 'WEST PENN', 'AQ225', 16, 2, 'NO', 'FPLW (húmedo)', 13.5, 'EXTERIORES SLC/NAC/24VDC', 'Ficha West Penn AQ225 Aquaseal. Verificar R exacta', 7),
  ('c09', 'WEST PENN', 'AQ294', 16, 4, 'SÍ', 'FPLW (húmedo)', 13.5, 'EXTERIORES RED', 'Ficha West Penn AQ294. Verificar R exacta', 8),
  ('c10', 'GENÉRICO', 'THHN-12', 12, 2, 'NO', 'THHN en EMT', 5.21, 'NAC', 'Tabla NEC Cap. 9 Tabla 8 (cobre, 75°C ajustar)', 9),
  ('c11', 'GENÉRICO', 'THHN-14', 14, 2, 'NO', 'THHN en EMT', 8.28, 'NAC', 'Tabla NEC Cap. 9 Tabla 8', 10),
  ('c12', 'GENÉRICO', 'THHN-16', 16, 2, 'NO', 'THHN en EMT', 13.17, 'SLC/NAC', 'Tabla NEC Cap. 9 Tabla 8', 11),
  ('c13', 'GENÉRICO', 'THHN-18', 18, 2, 'NO', 'THHN en EMT', 20.95, 'SLC', 'Tabla NEC Cap. 9 Tabla 8', 12)
on conflict (id) do nothing;

insert into public.baterias (id, ah, ref_simplex, ref_notifier, ref_generica, obs, orden) values
  ('b01', 6.2, '2081-9272', 'PS-1270 (7Ah)', '12V 7Ah', 'Gabinete panel pequeño', 0),
  ('b02', 10, '2081-9271', 'PS-12100', '12V 10Ah', '', 1),
  ('b03', 12.7, '2081-9287', 'PS-12120 (12Ah)', '12V 12Ah', 'Verificar ref. Simplex exacta', 2),
  ('b04', 18, '2081-9274', 'PS-12180', '12V 18Ah', '', 3),
  ('b05', 25, '2081-9275', 'PS-12260 (26Ah)', '12V 25Ah', 'Puede requerir gabinete de baterías', 4),
  ('b06', 33, '2081-9288', 'PS-12330', '12V 33Ah', 'Gabinete externo típico', 5),
  ('b07', 50, '2081-9296', 'PS-12500', '12V 50Ah', 'Gabinete externo + cargador verificar', 6),
  ('b08', 110, '—', 'PS-121100', '12V 110Ah', 'Solo con cargador externo listado', 7)
on conflict (id) do nothing;

commit;
