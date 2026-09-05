-- Context: warmup âm giai hằng ngày; chọn mẫu tự do, không khóa theo phút.
BEGIN;
ALTER TABLE public.edu_tools ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.edu_tools SET config = jsonb_set(coalesce(config, '{}'::jsonb), '{scale_warmups}', $warmups$[
  {
    "id": "major6",
    "noteNames": {
      "0": "Đô",
      "2": "Rê",
      "4": "Mi",
      "5": "Fa",
      "7": "Sol",
      "9": "La",
      "11": "Si"
    },
    "name": "Âm giai Trưởng",
    "subtitle": "Đô trưởng · Thế dây 6",
    "pos": {
      "frets": [
        [
          5,
          7,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7
        ],
        [
          4,
          5,
          7
        ],
        [
          5,
          6,
          8
        ],
        [
          5,
          7,
          8
        ]
      ]
    },
    "roots": [
      {
        "s": 0,
        "f": 8
      },
      {
        "s": 3,
        "f": 5
      },
      {
        "s": 5,
        "f": 8
      }
    ]
  },
  {
    "id": "major5",
    "noteNames": {
      "0": "Đô",
      "2": "Rê",
      "4": "Mi",
      "5": "Fa",
      "7": "Sol",
      "9": "La",
      "10": "Si♭"
    },
    "name": "Âm giai Trưởng",
    "subtitle": "Fa trưởng · Thế dây 5",
    "pos": {
      "frets": [
        [
          5,
          6,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7
        ],
        [
          5,
          6,
          8
        ],
        [
          5,
          6,
          8
        ]
      ]
    },
    "roots": [
      {
        "s": 1,
        "f": 8
      },
      {
        "s": 4,
        "f": 6
      }
    ]
  },
  {
    "id": "minor6",
    "noteNames": {
      "0": "Đô",
      "2": "Rê",
      "4": "Mi",
      "5": "Fa",
      "7": "Sol",
      "9": "La",
      "11": "Si"
    },
    "name": "Âm giai thứ tự nhiên",
    "subtitle": "La thứ · Thế dây 6",
    "pos": {
      "frets": [
        [
          5,
          7,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7
        ],
        [
          4,
          5,
          7
        ],
        [
          5,
          6,
          8
        ],
        [
          5,
          7,
          8
        ]
      ]
    },
    "roots": [
      {
        "s": 0,
        "f": 5
      },
      {
        "s": 2,
        "f": 7
      },
      {
        "s": 5,
        "f": 5
      }
    ]
  },
  {
    "id": "minor5",
    "noteNames": {
      "0": "Đô",
      "2": "Rê",
      "4": "Mi",
      "5": "Fa",
      "7": "Sol",
      "9": "La",
      "10": "Si♭"
    },
    "name": "Âm giai thứ tự nhiên",
    "subtitle": "Rê thứ · Thế dây 5",
    "pos": {
      "frets": [
        [
          5,
          6,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7
        ],
        [
          5,
          6,
          8
        ],
        [
          5,
          6,
          8
        ]
      ]
    },
    "roots": [
      {
        "s": 1,
        "f": 5
      },
      {
        "s": 3,
        "f": 7
      }
    ]
  },
  {
    "id": "harmonic-minor6",
    "noteNames": {
      "0": "Đô",
      "2": "Rê",
      "4": "Mi",
      "5": "Fa",
      "8": "Sol♯",
      "9": "La",
      "11": "Si"
    },
    "name": "Âm giai thứ hòa thanh",
    "subtitle": "La thứ hòa thanh · Thế dây 6",
    "pos": {
      "frets": [
        [
          5,
          7,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          6,
          7
        ],
        [
          4,
          5,
          7
        ],
        [
          5,
          6,
          9
        ],
        [
          5,
          7,
          8
        ]
      ]
    },
    "roots": [
      {
        "s": 0,
        "f": 5
      },
      {
        "s": 2,
        "f": 7
      },
      {
        "s": 5,
        "f": 5
      }
    ]
  },
  {
    "id": "harmonic-minor5",
    "noteNames": {
      "1": "Đô♯",
      "2": "Rê",
      "4": "Mi",
      "5": "Fa",
      "7": "Sol",
      "9": "La",
      "10": "Si♭"
    },
    "name": "Âm giai thứ hòa thanh",
    "subtitle": "Rê thứ hòa thanh · Thế dây 5",
    "pos": {
      "frets": [
        [
          5,
          6,
          9
        ],
        [
          5,
          7,
          8
        ],
        [
          5,
          7,
          8
        ],
        [
          6,
          7
        ],
        [
          5,
          6,
          8
        ],
        [
          5,
          6,
          9
        ]
      ]
    },
    "roots": [
      {
        "s": 1,
        "f": 5
      },
      {
        "s": 3,
        "f": 7
      }
    ]
  }
]$warmups$::jsonb) WHERE id = 'bai-luyen-am-giai';
NOTIFY pgrst, 'reload schema';
COMMIT;
