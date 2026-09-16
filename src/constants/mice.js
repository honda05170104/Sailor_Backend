export const MouseForm = Object.freeze({
  LIVE: 'live',
  FROZEN: 'frozen',
});

export const MouseSize = Object.freeze({
  SMALL: 'small',
  LARGE: 'large',
});

export const MouseUnit = Object.freeze({
  EACH: 'each',
  PACK: 'pack',
});

export const MouseSpec = Object.freeze({
  AGED: 'aged',
  HAIRLESS: 'hairless',
  FUZZY: 'fuzzy',
  HOPPER: 'hopper',
  EYED: 'eyed',
  SMALL_LARGE: 'smallLarge',
  MEDIUM_LARGE: 'mediumLarge',
  SMALL_SUBADULT: 'smallSubadult',
  SUBADULT: 'subadult',
  ADULT: 'adult',
  EXTRA_ADULT: 'extraAdult',
});

export const MOUSE_FORMS = Object.freeze(Object.values(MouseForm));
export const MOUSE_SIZES = Object.freeze(Object.values(MouseSize));
export const MOUSE_SPECS = Object.freeze(Object.values(MouseSpec));

export const MOUSE_FORM_LABELS = Object.freeze({
  [MouseForm.LIVE]: '活體',
  [MouseForm.FROZEN]: '冷凍',
});

export const MOUSE_SIZE_LABELS = Object.freeze({
  [MouseSize.SMALL]: '小白',
  [MouseSize.LARGE]: '大白',
});

export const MOUSE_UNIT_LABELS = Object.freeze({
  [MouseUnit.EACH]: '隻',
  [MouseUnit.PACK]: '包',
});

export const MOUSE_SPEC_LABELS = Object.freeze({
  [MouseSpec.AGED]: '日齡',
  [MouseSpec.HAIRLESS]: '無毛',
  [MouseSpec.FUZZY]: '微毛',
  [MouseSpec.HOPPER]: '跳跳',
  [MouseSpec.EYED]: '開眼',
  [MouseSpec.SMALL_LARGE]: '小大',
  [MouseSpec.MEDIUM_LARGE]: '中大',
  [MouseSpec.SMALL_SUBADULT]: '小亞成',
  [MouseSpec.SUBADULT]: '亞成',
  [MouseSpec.ADULT]: '成體',
  [MouseSpec.EXTRA_ADULT]: '超成體',
});

export const MOUSE_AGE_DAYS = Object.freeze({
  min: 1,
  max: 60,
});

export const MOUSE_PACKS = Object.freeze({
  min: 1,
  max: 9999,
});

export const MOUSE_PER_PACK = Object.freeze({
  min: 1,
  max: 999,
});

const SMALL_SPECS = [
  MouseSpec.AGED,
  MouseSpec.HAIRLESS,
  MouseSpec.FUZZY,
  MouseSpec.HOPPER,
  MouseSpec.SUBADULT,
  MouseSpec.ADULT,
];

const LARGE_SPECS = [
  MouseSpec.AGED,
  MouseSpec.FUZZY,
  MouseSpec.EYED,
  MouseSpec.SMALL_LARGE,
  MouseSpec.MEDIUM_LARGE,
  MouseSpec.SMALL_SUBADULT,
  MouseSpec.SUBADULT,
  MouseSpec.ADULT,
  MouseSpec.EXTRA_ADULT,
];

const LIVE_SMALL_PRICES = Object.freeze({
  [MouseSpec.AGED]: 20,
  [MouseSpec.HAIRLESS]: 20,
  [MouseSpec.FUZZY]: 20,
  [MouseSpec.HOPPER]: 20,
  [MouseSpec.SUBADULT]: 25,
  [MouseSpec.ADULT]: 50,
});

function specOption(id, { unit, price = null, perPack = null } = {}) {
  return Object.freeze({
    id,
    label: MOUSE_SPEC_LABELS[id],
    unit,
    unitLabel: MOUSE_UNIT_LABELS[unit],
    price,
    perPack,
    needsAgeDays: id === MouseSpec.AGED,
  });
}

function liveSpecs(ids, prices) {
  return Object.freeze(
    ids.map((id) =>
      specOption(id, {
        unit: MouseUnit.EACH,
        price: prices[id] ?? null,
      })
    )
  );
}

function frozenSpecs(ids) {
  return Object.freeze(
    ids.map((id) =>
      specOption(id, {
        unit: MouseUnit.PACK,
        price: null,
        perPack: null,
      })
    )
  );
}

export const MOUSE_TABLE = Object.freeze([
  Object.freeze({
    form: MouseForm.LIVE,
    size: MouseSize.SMALL,
    formLabel: MOUSE_FORM_LABELS[MouseForm.LIVE],
    sizeLabel: MOUSE_SIZE_LABELS[MouseSize.SMALL],
    specs: liveSpecs(SMALL_SPECS, LIVE_SMALL_PRICES),
  }),
  Object.freeze({
    form: MouseForm.FROZEN,
    size: MouseSize.SMALL,
    formLabel: MOUSE_FORM_LABELS[MouseForm.FROZEN],
    sizeLabel: MOUSE_SIZE_LABELS[MouseSize.SMALL],
    specs: frozenSpecs(SMALL_SPECS),
  }),
  Object.freeze({
    form: MouseForm.LIVE,
    size: MouseSize.LARGE,
    formLabel: MOUSE_FORM_LABELS[MouseForm.LIVE],
    sizeLabel: MOUSE_SIZE_LABELS[MouseSize.LARGE],
    specs: liveSpecs(LARGE_SPECS, {}),
  }),
  Object.freeze({
    form: MouseForm.FROZEN,
    size: MouseSize.LARGE,
    formLabel: MOUSE_FORM_LABELS[MouseForm.FROZEN],
    sizeLabel: MOUSE_SIZE_LABELS[MouseSize.LARGE],
    specs: frozenSpecs(LARGE_SPECS),
  }),
]);

export function mouseRow(form, size) {
  return MOUSE_TABLE.find((row) => row.form === form && row.size === size) || null;
}

export function specsFor(form, size) {
  return mouseRow(form, size)?.specs || [];
}

export function isAllowedSpec(form, size, spec) {
  return specsFor(form, size).some((item) => item.id === spec);
}

export function mouseCatalog() {
  return {
    forms: MOUSE_FORMS.map((id) => ({ id, label: MOUSE_FORM_LABELS[id] })),
    sizes: MOUSE_SIZES.map((id) => ({ id, label: MOUSE_SIZE_LABELS[id] })),
    units: {
      [MouseUnit.EACH]: MOUSE_UNIT_LABELS[MouseUnit.EACH],
      [MouseUnit.PACK]: MOUSE_UNIT_LABELS[MouseUnit.PACK],
    },
    ageDays: MOUSE_AGE_DAYS,
    packs: MOUSE_PACKS,
    perPack: MOUSE_PER_PACK,
    table: MOUSE_TABLE,
  };
}
