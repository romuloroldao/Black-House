import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/**
 * Celular deitado continua celular: a mesma regra de src/lib/device.ts (ponteiro grosso e menor lado
 * da tela até 767px) entra nos breakpoints de 768px. Computador (ponteiro fino) e tablet (os dois lados
 * a partir de 768px) continuam casando exatamente como antes.
 */
const PHONE = "(pointer: coarse) and (max-device-width: 767px), (pointer: coarse) and (max-device-height: 767px)";
const MD_NOT_PHONE =
  "(min-width: 768px) and (pointer: fine), (min-width: 768px) and (pointer: none), " +
  "(min-width: 768px) and (min-device-width: 768px) and (min-device-height: 768px)";

const REWRITES = {
  "(min-width: 768px)": MD_NOT_PHONE,
  "not all and (min-width: 768px)": `not all and (min-width: 768px), ${PHONE}`,
  "(max-width: 767px)": `(max-width: 767px), ${PHONE}`,
};

const phoneBreakpoints = () => ({
  postcssPlugin: "bh-phone-breakpoints",
  AtRule: {
    media(atRule) {
      const params = atRule.params.trim();
      if (REWRITES[params]) atRule.params = REWRITES[params];
    },
  },
});
phoneBreakpoints.postcss = true;

export default {
  plugins: [tailwindcss(), phoneBreakpoints(), autoprefixer()],
};
