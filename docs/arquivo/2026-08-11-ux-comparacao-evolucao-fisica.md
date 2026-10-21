# UX — Comparação de Evolução Física

**Data:** 2026-08-11

## Objectivo

Reorganizar a interface do comparador para priorizar a percepção de evolução corporal, com complexidade progressiva. Capacidade funcional preservada.

## Hierarquia

1. Período + peso (delta do par Antes↔Depois)
2. Viewport de fotos (área dominante)
3. Modos: Comparar | Lado a lado | Alinhar
4. Ângulos em segmented control
5. «Ajustar comparação» → bottom sheet

## Modos

| UI | Interno | Controlo avançado |
|----|---------|-------------------|
| Comparar | `split` | Hint arraste (1ª vez); sem zoom/guias |
| Lado a lado | `sideBySide` | Sem zoom até Alinhar |
| Alinhar | split / sideBySide / flash | Guias, sync, zoom, regiões, Space |

## Ficheiros

- `compare/CompareEvolutionWorkspace.tsx` — orquestração
- `compare/ComparisonPeriodHeader.tsx`
- `compare/ComparisonModeTabs.tsx`
- `compare/AnglePoseSelector.tsx`
- `compare/ComparisonViewportShell.tsx`
- `compare/AdvancedCompareSheet.tsx`
- `ComparisonSlider.tsx` / `ImageViewport.tsx` — zoom opcional + hint
- `i18n/evolution-photos.ts` — copy orientada ao utilizador
- `evolution-timeline.ts` — `weightDeltaBetween`

## Aceite

- Foto dominante; Comparar default
- Delta de peso reflecte o par seleccionado
- Controlo avançado escondido até Alinhar / Ajustar
- Sem overflow horizontal intencional
