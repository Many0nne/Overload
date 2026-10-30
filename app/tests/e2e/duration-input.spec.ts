import { v7 as uuidv7 } from 'uuid';
import type { RoutineDoc } from '@/domain/types';
import { admin, expect, localWorkoutDoc, login, test } from './fixtures';

const PLANK = { id: '580627cc-e230-58d1-98d5-5a3e90a620f9', name: 'Gainage (planche)' };

// Cette méthode permet de vérifier que la saisie d'une durée insère « : » au fil de la frappe (façon minuteur)
// et que la valeur enregistrée est celle de parseDuration (#115).
test('durée d’une série chronométrée : « : » automatique, effacement par la droite, valeur enregistrée', async ({
  page,
  seeded,
}) => {
  const routineDoc: RoutineDoc = {
    schemaVersion: 1,
    name: 'Gainage E2E',
    exercises: [
      {
        id: uuidv7(),
        exerciseId: PLANK.id,
        restS: 60,
        sets: [{ id: uuidv7(), kind: 'normal' as const }],
      },
    ],
  };
  const { error } = await admin().from('routines').insert({
    id: uuidv7(),
    user_id: seeded.account.userId,
    folder_id: null,
    position: 1,
    doc: routineDoc,
    client_updated_at: Date.now(),
    client_device_id: '22222222-2222-7222-8222-222222222222',
  });
  expect(error).toBeNull();

  await login(page, seeded.account);
  await page.getByRole('link', { name: 'Séance' }).click();
  await page
    .locator('.card.routine', { hasText: 'Gainage E2E' })
    .getByRole('button', { name: 'Démarrer' })
    .click();
  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]+$/);
  const workoutId = page.url().split('/').pop()!;

  const input = page.locator('.ex', { hasText: PLANK.name }).locator('tr.set').first().getByLabel('Durée');
  await input.click();
  await input.pressSequentially('130');
  await expect(input).toHaveValue('1:30');
  await input.press('Backspace');
  await expect(input).toHaveValue('0:13');
  await input.pressSequentially('0');
  await expect(input).toHaveValue('1:30');
  await input.pressSequentially('0');
  await expect(input).toHaveValue('13:00');
  await input.press('Enter');
  await expect(input).toHaveValue('13:00');
  await expect
    .poll(async () => (await localWorkoutDoc(page, workoutId))?.exercises[0]?.sets[0]?.durationS)
    .toBe(13 * 60);
});
