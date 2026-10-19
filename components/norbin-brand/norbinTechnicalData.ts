/*
 * Norbin tehnički podaci i dokumenti (2026-10-19).
 *
 * Generisano iz provere zvaničnih tehničkih (TDS) i bezbednosnih (SDS) listova
 * sa norbin-paint.com (pregled: docs/norbin/tehnicki-podaci-2026-10-19.md).
 * Svaka vrednost je iz tehničkog lista navedenog proizvoda, sa stranom; polja
 * koja list ne navodi su izostavljena. Ne dopisivati vrednosti ručno.
 *
 * Za učvršćivače, razređivač i silikon-čistač postoje samo kratki listovi na
 * turskom (namena, skladištenje, rok trajanja); engleske verzije ne postoje.
 */
export type NorbinDocument = { url: string; language: string; version: string | null };
export type NorbinTechnicalRow = { label: string; value: string; page: number | null };
export type NorbinTechnicalProduct = {
  code: string;
  name: string;
  tds: NorbinDocument | null;
  sds: NorbinDocument | null;
  rows: NorbinTechnicalRow[];
};

export const norbinTechnicalProducts: NorbinTechnicalProduct[] = [
  {
    "code": "N15-020",
    "name": "NORBIN Clear",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/NORBIN_TDS_N15-020_Clear_2022.pdf",
      "language": "engleski",
      "version": "01/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/N15-020_Clear_1L.PDF",
      "language": "engleski",
      "version": "v3.0, 30.10.2021, 1 L"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "2:1 po zapremini",
        "page": 1
      },
      {
        "label": "Učvršćivač",
        "value": "N75-021 Hardener Normal ili N75-022 Hardener Slow",
        "page": 1
      },
      {
        "label": "Vreme upotrebe (20 °C)",
        "value": "2 h",
        "page": 1
      },
      {
        "label": "Broj slojeva",
        "value": "2",
        "page": 1
      },
      {
        "label": "Debljina suvog filma",
        "value": "50-60 µm",
        "page": 1
      },
      {
        "label": "Sušenje 20 °C",
        "value": "5 h (spremno za montažu)",
        "page": 2
      },
      {
        "label": "Sušenje 60 °C",
        "value": "30 min",
        "page": 2
      },
      {
        "label": "Rok trajanja",
        "value": "24 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N15-V20",
    "name": "NORBIN Clear VOC",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/NORBIN_TDS_N15-V20_Clear_VOC_2022.pdf",
      "language": "engleski",
      "version": "01/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/MSDS_N15-V20_4L_en.PDF",
      "language": "engleski",
      "version": "v3.0, 24.06.2021, 4 L"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "4:1 po zapremini",
        "page": 1
      },
      {
        "label": "Učvršćivač",
        "value": "N75-V21 Clear Hardener VOC",
        "page": 1
      },
      {
        "label": "Vreme upotrebe (20 °C)",
        "value": "1,5 h",
        "page": 1
      },
      {
        "label": "Broj slojeva",
        "value": "2",
        "page": 1
      },
      {
        "label": "Debljina suvog filma",
        "value": "50 µm",
        "page": 1
      },
      {
        "label": "Sušenje 20 °C",
        "value": "5 h (spremno za montažu)",
        "page": 2
      },
      {
        "label": "Sušenje 60 °C",
        "value": "30 min",
        "page": 2
      },
      {
        "label": "VOC",
        "value": "419 g/l (EU limit 420 g/l, kat. IIB.d)",
        "page": 1
      },
      {
        "label": "Rok trajanja",
        "value": "24 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N15-V25",
    "name": "NORBIN Fast Clear VOC",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/N15-V25_Fast_Clear_VOC_2.pdf",
      "language": "engleski",
      "version": "05/2023"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N15-V25_5L_en.PDF",
      "language": "engleski",
      "version": "v3.1, 04.08.2021, 5 L"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "3:1:1 po zapremini",
        "page": 1
      },
      {
        "label": "Učvršćivač",
        "value": "N75-V21 Clear Hardener VOC",
        "page": 1
      },
      {
        "label": "Razređivač",
        "value": "N85-021 Thinner",
        "page": 1
      },
      {
        "label": "Vreme upotrebe (20 °C)",
        "value": "1,5 h",
        "page": 1
      },
      {
        "label": "Broj slojeva",
        "value": "2 sloja sa 3 min između, ili 1 tanak + 1 pun bez pauze (vertikalno)",
        "page": 2
      },
      {
        "label": "Debljina suvog filma",
        "value": "40-60 µm",
        "page": 2
      },
      {
        "label": "Sušenje 20 °C",
        "value": "2 h bez prašine; 3 h spremno za montažu",
        "page": 2
      },
      {
        "label": "Sušenje 60 °C",
        "value": "20 min",
        "page": 2
      },
      {
        "label": "VOC",
        "value": "419 g/l (EU limit 420 g/l, kat. IIB.d)",
        "page": 1
      },
      {
        "label": "Rok trajanja",
        "value": "36 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N55-015",
    "name": "NORBIN 1K Plastic Primer",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/N55-015_1K_Plastic_Primer.pdf",
      "language": "engleski",
      "version": "01/2023"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N55-0151KPlasticPrimer_1L_en.PDF",
      "language": "engleski",
      "version": "v2.3, 14.11.2022, 1 L"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "spreman za upotrebu (1K)",
        "page": 1
      },
      {
        "label": "Broj slojeva",
        "value": "1-2 tanka sloja",
        "page": 1
      },
      {
        "label": "Debljina suvog filma",
        "value": "10 µm",
        "page": 1
      },
      {
        "label": "Rok trajanja",
        "value": "24 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N55-V20",
    "name": "NORBIN 2K Primer Filler grey",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/N55-V20_2K_Primer_Filler_grey.pdf",
      "language": "engleski",
      "version": "12/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N55-V20_2_5L_en.PDF",
      "language": "engleski",
      "version": "v3.1, 14.06.2021, 2,5 L"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "5:1:1 po zapremini",
        "page": 1
      },
      {
        "label": "Učvršćivač",
        "value": "N75-020 Hardener Fast",
        "page": 1
      },
      {
        "label": "Razređivač",
        "value": "N85-021 Thinner",
        "page": 1
      },
      {
        "label": "Vreme upotrebe (20 °C)",
        "value": "1 h",
        "page": 1
      },
      {
        "label": "Broj slojeva",
        "value": "2 (high build: 3-4 sloja do mat)",
        "page": 2
      },
      {
        "label": "Debljina suvog filma",
        "value": "50-70 (high build 70-160) µm",
        "page": 2
      },
      {
        "label": "Sušenje 20 °C",
        "value": "3 h",
        "page": 2
      },
      {
        "label": "Sušenje 60 °C",
        "value": "30 min",
        "page": 2
      },
      {
        "label": "VOC",
        "value": "539 g/l (EU limit 540 g/l, kat. IIB.c I)",
        "page": 1
      },
      {
        "label": "Brušenje",
        "value": "ručno mokro P800; orbitalno suvo P400/P500",
        "page": 2
      },
      {
        "label": "Rok trajanja",
        "value": "24 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N55-V29",
    "name": "NORBIN 2K Primer Filler black",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/N55-V29_2K_Primer_Filler_black.pdf",
      "language": "engleski",
      "version": "10/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N55-V29_2-5L_en.PDF",
      "language": "engleski",
      "version": "v3.1, 05.07.2022, 2,5 L"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "5:1:1 po zapremini",
        "page": 1
      },
      {
        "label": "Učvršćivač",
        "value": "N75-020 Hardener Fast",
        "page": 1
      },
      {
        "label": "Razređivač",
        "value": "N85-025 Thinner (EN 10/2022); N85-021 (TR 12/2022)",
        "page": 1
      },
      {
        "label": "Vreme upotrebe (20 °C)",
        "value": "1 h",
        "page": 1
      },
      {
        "label": "Broj slojeva",
        "value": "2 (high build: 3-4 sloja do mat)",
        "page": 2
      },
      {
        "label": "Debljina suvog filma",
        "value": "50-70 (high build 70-160) µm",
        "page": 2
      },
      {
        "label": "Sušenje 20 °C",
        "value": "3 h",
        "page": 2
      },
      {
        "label": "Sušenje 60 °C",
        "value": "30 min",
        "page": 2
      },
      {
        "label": "VOC",
        "value": "539 g/l (EU limit 540 g/l, kat. IIB.c I)",
        "page": 1
      },
      {
        "label": "Brušenje",
        "value": "ručno mokro P800; orbitalno suvo P400/P500",
        "page": 2
      },
      {
        "label": "Rok trajanja",
        "value": "24 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N60-V20",
    "name": "NORBIN Multifunctional Body Filler + Hardener",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/N60-V20_Multifunctional_Body_Filler_Hardener.pdf",
      "language": "engleski",
      "version": "01/2023"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N60-V20_1.95KG_bodyfiller_en.PDF",
      "language": "engleski",
      "version": "v1.1, 01.01.2023, kit 1,95 kg"
    },
    "rows": [
      {
        "label": "Odnos mešanja",
        "value": "100 : 2-3 po masi",
        "page": 1
      },
      {
        "label": "Učvršćivač",
        "value": "NORBIN Body Filler Hardener (u kompletu)",
        "page": 1
      },
      {
        "label": "Vreme upotrebe (20 °C)",
        "value": "4-6 min (sobna temperatura)",
        "page": 1
      },
      {
        "label": "Sušenje 20 °C",
        "value": "20-30 min",
        "page": 1
      },
      {
        "label": "Sušenje 60 °C",
        "value": "10 min",
        "page": 1
      },
      {
        "label": "VOC",
        "value": "249 g/l (EU limit 250 g/l, kat. IIB.b)",
        "page": 1
      },
      {
        "label": "Brušenje",
        "value": "orbitalno suvo P80/P120/P240/P320",
        "page": 1
      },
      {
        "label": "Rok trajanja",
        "value": "12 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N75-020",
    "name": "NORBIN Hardener Fast",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/TR/N75-020.pdf",
      "language": "turski",
      "version": "01/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N75-020_0_5L_en.PDF",
      "language": "engleski",
      "version": "v4.0, 25.06.2021, 0,5 L"
    },
    "rows": [
      {
        "label": "Rok trajanja",
        "value": "12 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N75-021",
    "name": "NORBIN Hardener Normal",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/TR/N75-021.pdf",
      "language": "turski",
      "version": "01/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N75-021_new_0_5L_en.PDF",
      "language": "engleski",
      "version": "v3.1, 02.06.2021, 0,5 L"
    },
    "rows": [
      {
        "label": "Rok trajanja",
        "value": "12 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N75-022",
    "name": "NORBIN Hardener Slow",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/TR/N75-022.pdf",
      "language": "turski",
      "version": "01/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N75-022_0_5L_en.PDF",
      "language": "engleski",
      "version": "v4.0, 06.04.2021, 2,5 L"
    },
    "rows": [
      {
        "label": "Rok trajanja",
        "value": "12 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N75-V21",
    "name": "NORBIN Clear Hardener VOC",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/TR/N75-V21.pdf",
      "language": "turski",
      "version": "01/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/MSDS_N75-V21_1L_en.PDF",
      "language": "engleski",
      "version": "v1.0, 26.10.2020, 1 L"
    },
    "rows": [
      {
        "label": "Rok trajanja",
        "value": "12 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N85-021",
    "name": "NORBIN Thinner",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/TR/N85-021.pdf",
      "language": "turski",
      "version": "02/2022"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N85-021_1L_en.PDF",
      "language": "engleski",
      "version": "v4.0, 14.10.2021, 1 L"
    },
    "rows": [
      {
        "label": "Rok trajanja",
        "value": "60 meseci",
        "page": 1
      }
    ]
  },
  {
    "code": "N95-060",
    "name": "NORBIN Silicone Cleaner",
    "tds": {
      "url": "https://www.norbin-paint.com/files/TDS/N95-060_Silicone_Cleaner.pdf",
      "language": "engleski",
      "version": "01/2023"
    },
    "sds": {
      "url": "https://www.norbin-paint.com/files/MSDS/SDS_N95-060SiliconeCleaner_5L_en.PDF",
      "language": "engleski",
      "version": "v3.3, 16.12.2022, 5 L"
    },
    "rows": [
      {
        "label": "Rok trajanja",
        "value": "60 meseci",
        "page": 1
      }
    ]
  }
];
