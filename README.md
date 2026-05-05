Actúa como un arquitecto senior de frontend especializado en refactorización de aplicaciones web modernas.

Tu tarea no es rehacer la app desde cero, sino analizar el proyecto actual de KNOX y proponer una refactorización progresiva, segura y bien estructurada.

Objetivo principal:
Transformar una base de código monolítica en una arquitectura modular, mantenible y escalable, sin romper funcionalidades existentes.

Quiero que evalúes y diseñes mejoras en estas áreas:

1. Componentización
- Divide la app en componentes pequeños e independientes.
- Separar lógica y UI en piezas claras: reproductor de video, tarjeta de anime, barra de navegación, favoritos, login, búsqueda, etc.
- Cada componente debe tener una responsabilidad única.
- Evita archivos gigantes que mezclen demasiadas funciones.

2. Flujo de datos y reactividad
- Convierte la interfaz en un sistema reactivo, donde el estado gobierna la UI.
- Evita manipulación manual y repetitiva del DOM.
- Los cambios en datos como favoritos, sesión, búsqueda o estado del anime deben reflejarse automáticamente en toda la interfaz.
- Prioriza una arquitectura donde el estado sea la fuente de verdad.

3. Build system y optimización
- Diseña una migración hacia un pipeline moderno con Vite.
- Busca mejorar tiempos de carga, organización del proyecto y optimización del bundle.
- Elimina código innecesario, mejora el orden del proyecto y prepara la app para producción.
- Considera minificación, separación de módulos y mejor rendimiento en dispositivos móviles.

4. PWA y experiencia offline
- Mejora o reemplaza la gestión manual de service worker por una solución más robusta.
- Diseña una PWA más confiable, con cache inteligente, actualizaciones seguras y soporte offline estable.
- Evita problemas típicos de versiones viejas atrapadas en caché.

5. Estética y CSS
- Reestructura los estilos para que no se mezclen entre pantallas.
- Usa CSS modular o una organización equivalente que evite conflictos.
- Mantén una estética oscura, premium y moderna.
- Añade transiciones suaves entre vistas, animaciones ligeras y mejor jerarquía visual.

Restricciones importantes:
- No rompas funcionalidades existentes.
- No hagas cambios innecesarios.
- Prioriza compatibilidad, orden y escalabilidad.
- Si detectas problemas de diseño o arquitectura, explícalos con claridad.
- Si propones nuevas dependencias o herramientas, justifica por qué valen la pena.

Entregables que necesito:
1. Un diagnóstico breve de la arquitectura actual.
2. Una propuesta de estructura de carpetas ideal.
3. Una lista de componentes y responsabilidades.
4. Un plan de migración por fases, empezando por lo más seguro.
5. Recomendaciones concretas de rendimiento, mantenibilidad y UX.
6. Si detectas riesgos, indícalos junto con una solución.

Antes de cambiar código, analiza el repositorio y explica qué vas a tocar y por qué.