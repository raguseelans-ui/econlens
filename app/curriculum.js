// Lookups into config/curriculum.json. This file holds no curriculum data of its own:
// every theme, spec title, skill label, question kind and status label comes from the config.

export function makeCurriculum(config) {
  const specs = new Map(config.spec_codes.map((s) => [s.code, s]));
  const themes = new Map(config.themes.map((t) => [t.id, t]));
  return {
    config,
    themes: config.themes,
    specCodes: config.spec_codes,
    spec: (code) => specs.get(code) || null,
    specTitle: (code) => (specs.get(code) || {}).title || "",
    themeOf: (code) => {
      const s = specs.get(code);
      return s ? themes.get(s.theme) || null : null;
    },
    skill: (key) => config.skills.find((s) => s.key === key) || { key, label: key },
    kind: (key) => config.question_kinds[key] || { label: key, total_marks: null, level_tables: [] },
    status: (key) => config.statuses.find((s) => s.key === key) || { key, label: key },
    mcqType: (key) => (config.mcq_types.find((t) => t.key === key) || { label: key }).label,
  };
}
