import type { PetFormState } from "./PetFormFields";

export const INITIAL_PET_STATE: PetFormState = {
  name: "",
  species: "dog",
  sex: "",
  isFixed: false,
  breed: "",
  coatType: "",
  sizeKg: "",
  birthDate: "",
  temperament: "",
  medicalConditions: "",
  notes: "",
  vaccinations: [],
  imageStorageId: undefined,
  imagePreviewUrl: null,
};

/**
 * Snapshot used for dirty-checking. Excludes:
 *  - `imageStorageId` because photos are saved separately via `pets.setImage`
 *    the moment they're uploaded — they shouldn't drive the Save button.
 *  - `imagePreviewUrl` because it's just a transient CDN/blob URL whose
 *    identity doesn't reflect a user change.
 */
export function petFormSnapshot(state: PetFormState): string {
  const { imageStorageId: _img, imagePreviewUrl: _preview, ...comparable } =
    state;
  return JSON.stringify(comparable);
}
