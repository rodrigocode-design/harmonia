export const IDS = {
  school: "sch_b3f9a2d4c8e7410ab526",
  unit: "unt_71e8c2a6f9344d09b115",
  actorUser: "usr_owner_runtime",
  actorStudent: "stu_owner_runtime",
  actorTeacher: "tea_owner_runtime",
  teacher2User: "usr_3a9d1f70c82e45c1b622",
  teacher2: "tea_a6c4f9821b7d43e0a355",
  student1User: "usr_8b2e14c670f94a63a441",
  student1: "stu_1e7a9c43d8504b62af20",
  student2User: "usr_5d7f2a19c0844e31b693",
  student2: "stu_4c91e8a2b70546f3ad77",
  student3User: "usr_2f6c8a40d9134b75a186",
  student3: "stu_9a31d5e70c264f48b522",
  guardianUser: "usr_7c20e4a91d5f43b8a366",
  coursePiano: "crs_42f0a7c91e3b4d68a255",
  courseGuitar: "crs_9d17b3e60a824cf1b744",
  instrumentPiano: "ins_5e82a1d94b704c36a617",
  instrumentGuitar: "ins_c4a709e32d184b65a298",
  room1: "rom_31a6f8c20d954e7ba443",
  room2: "rom_8d2b5e19a6404f73b156",
  classPiano: "cls_6a4e1d83f9204b75a312",
  classGuitar: "cls_2c9f5a70d1844e63b827",
  plan: "pln_7f21d9c4a6504e38b115",
  repertoire1: "rep_4a8d1c70e2954f63b822",
  repertoire2: "rep_9c2e5a41d7804b36a617",
} as const;

export const ROLE_NAMES = {
  ADMIN: "Administrador",
  DIRECAO: "Direção",
  SECRETARIA: "Secretaria",
  COORDENACAO: "Coordenação pedagógica",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
  RESPONSAVEL: "Responsável",
  FINANCEIRO: "Financeiro",
} as const;

export function roleId(code: string): string {
  return `rol_${code.toLowerCase()}_harmonia`;
}

export function localIso(dayOffset: number, hour: number, minute = 0): string {
  const now = new Date();
  const localParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => localParts.find((item) => item.type === type)?.value ?? "";
  const midnightUtc = Date.parse(`${part("year")}-${part("month")}-${part("day")}T03:00:00.000Z`);
  return new Date(midnightUtc + dayOffset * 86_400_000 + hour * 3_600_000 + minute * 60_000).toISOString();
}
