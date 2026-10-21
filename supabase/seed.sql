-- Fichier généré par scripts/build-catalog.ts : ne pas modifier à la main.
-- Source : free-exercise-db @ f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5 (218 exercices).
insert into public.exercises
  (id, user_id, name, name_search, equipment, primary_muscle, secondary_muscles, measurement_type, instructions, source_id, client_updated_at, client_device_id)
values
  ('eee64d46-7f94-5743-ad72-c90d587e50a0', null, 'Développé couché (barre)', 'developpe couche (barre)', 'barbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Allonge-toi sur le banc, pieds ancrés au sol, omoplates serrées.
Saisis la barre un peu plus large que les épaules et décroche-la bras tendus.
Descends la barre de façon contrôlée jusqu''au milieu de la poitrine.
Pousse en expirant jusqu''à l''extension des bras sans décoller les fesses.', 'Barbell_Bench_Press_-_Medium_Grip', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('732382f1-d017-596c-9e61-07b16e05d9d6', null, 'Développé incliné (barre)', 'developpe incline (barre)', 'barbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Règle le banc à 30-45° et plaque les omoplates contre le dossier.
Décroche la barre prise un peu plus large que les épaules.
Descends-la vers le haut de la poitrine en contrôlant.
Pousse jusqu''à l''extension complète des bras.', 'Barbell_Incline_Bench_Press_-_Medium_Grip', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b4232493-faf3-5cce-b400-7465f0249a81', null, 'Développé décliné (barre)', 'developpe decline (barre)', 'barbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Cale tes jambes sur un banc décliné et saisis la barre prise moyenne.
Descends-la vers le bas de la poitrine en contrôlant.
Pousse en expirant jusqu''à l''extension des bras.', 'Decline_Barbell_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d12e347c-0f92-57c1-951d-87deb8633042', null, 'Développé couché prise serrée (barre)', 'developpe couche prise serree (barre)', 'barbell', 'triceps', array['chest', 'shoulders']::text[], 'weight_reps', 'Allonge-toi sur le banc et saisis la barre mains écartées à la largeur des épaules.
Descends la barre vers le bas de la poitrine, coudes près du corps.
Pousse jusqu''à l''extension des bras en sollicitant les triceps.', 'Close-Grip_Barbell_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5db01295-b057-56a3-af7a-02b52d296148', null, 'Développé couché prise large (barre)', 'developpe couche prise large (barre)', 'barbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Allonge-toi sur le banc et saisis la barre nettement plus large que les épaules.
Descends la barre vers le milieu de la poitrine en contrôlant.
Pousse en expirant jusqu''à l''extension des bras.', 'Wide-Grip_Barbell_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('36a8e69b-4e25-50d7-bba4-213e41e0f9b9', null, 'Développé couché (haltères)', 'developpe couche (halteres)', 'dumbbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Allonge-toi sur le banc, un haltère dans chaque main au niveau des pectoraux.
Pousse les haltères vers le haut jusqu''à l''extension des bras.
Redescends lentement jusqu''à sentir l''étirement de la poitrine.', 'Dumbbell_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4b142133-3055-545b-aab1-b0904dba0d67', null, 'Développé incliné (haltères)', 'developpe incline (halteres)', 'dumbbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Règle le banc à 30-45° et amène les haltères à hauteur de poitrine.
Pousse-les vers le haut en rapprochant légèrement les mains.
Redescends de façon contrôlée jusqu''à l''étirement des pectoraux.', 'Incline_Dumbbell_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3e08c8cc-bb6d-5140-b01e-8893aab020b8', null, 'Développé décliné (haltères)', 'developpe decline (halteres)', 'dumbbell', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Cale tes jambes sur un banc décliné, un haltère dans chaque main.
Pousse les haltères vers le haut jusqu''à l''extension des bras.
Redescends lentement vers le bas de la poitrine.', 'Decline_Dumbbell_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('01adb383-1145-5ad5-a67e-fb5d7e81d32a', null, 'Écarté couché (haltères)', 'ecarte couche (halteres)', 'dumbbell', 'chest', '{}'::text[], 'weight_reps', 'Allonge-toi sur le banc, haltères au-dessus de la poitrine, coudes légèrement fléchis.
Ouvre les bras en arc de cercle jusqu''à l''étirement des pectoraux.
Reviens en serrant la poitrine, comme pour enlacer un arbre.', 'Dumbbell_Flyes', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('04163d78-5092-50de-b30e-e1bf285b3517', null, 'Écarté incliné (haltères)', 'ecarte incline (halteres)', 'dumbbell', 'chest', array['shoulders']::text[], 'weight_reps', 'Règle le banc à 30° et tiens les haltères au-dessus du haut de la poitrine.
Ouvre les bras en gardant les coudes légèrement fléchis.
Reviens à la position de départ en contractant les pectoraux.', 'Incline_Dumbbell_Flyes', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1703e368-b324-579b-bf75-93b08530a846', null, 'Développé couché (machine)', 'developpe couche (machine)', 'machine', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Règle le siège pour que les poignées soient à hauteur de poitrine.
Pousse les poignées vers l''avant jusqu''à l''extension des bras.
Reviens lentement sans laisser les charges se reposer.', 'Machine_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('198ed171-e02f-5286-aa31-48c4f5433a9f', null, 'Développé convergent (machine)', 'developpe convergent (machine)', 'machine', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Règle le siège pour que les poignées soient à hauteur de poitrine.
Pousse les poignées en expirant jusqu''à l''extension des bras.
Reviens lentement en gardant les omoplates serrées.', 'Leverage_Chest_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f6c0f7c1-88a3-521a-ae01-170d4d1fccb5', null, 'Développé incliné convergent (machine)', 'developpe incline convergent (machine)', 'machine', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Installe-toi, dos plaqué, poignées à hauteur du haut de la poitrine.
Pousse vers le haut et l''avant jusqu''à l''extension des bras.
Reviens de façon contrôlée.', 'Leverage_Incline_Chest_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('79437d08-cd55-55e8-a5b0-74cacc279ae8', null, 'Pec deck (machine)', 'pec deck (machine)', 'machine', 'chest', '{}'::text[], 'weight_reps', 'Règle le siège pour que les bras soient à hauteur d''épaules.
Rapproche les poignées devant toi en serrant les pectoraux.
Reviens lentement jusqu''à l''étirement sans lâcher la charge.', 'Butterfly', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fe047ea3-04a2-52dc-951d-e90096c38220', null, 'Croisé aux poulies hautes', 'croise aux poulies hautes', 'cable', 'chest', array['shoulders']::text[], 'weight_reps', 'Place-toi entre deux poulies hautes, un pied en avant, buste légèrement penché.
Ramène les mains devant le bas de la poitrine, bras presque tendus.
Reviens lentement jusqu''à l''étirement des pectoraux.', 'Cable_Crossover', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2da37a27-8f6e-5264-a359-178a03433dcb', null, 'Croisé aux poulies basses', 'croise aux poulies basses', 'cable', 'chest', array['shoulders']::text[], 'weight_reps', 'Place-toi entre deux poulies basses, une poignée dans chaque main.
Monte les mains en arc de cercle devant le haut de la poitrine.
Contracte une seconde, puis redescends lentement.', 'Low_Cable_Crossover', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4628b0fe-a8d7-5d04-8317-781ce945a971', null, 'Écarté couché (poulie)', 'ecarte couche (poulie)', 'cable', 'chest', '{}'::text[], 'weight_reps', 'Allonge-toi sur un banc entre deux poulies basses, poignées en main.
Monte les bras au-dessus de la poitrine, coudes légèrement fléchis.
Redescends en arc de cercle jusqu''à l''étirement, puis recommence.', 'Flat_Bench_Cable_Flyes', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('671c4ccf-bbbd-5336-9d35-c28f4785419c', null, 'Écarté incliné (poulie)', 'ecarte incline (poulie)', 'cable', 'chest', array['shoulders']::text[], 'weight_reps', 'Règle le banc incliné entre deux poulies basses.
Monte les poignées en arc de cercle vers le haut de la poitrine.
Redescends lentement en gardant les coudes légèrement fléchis.', 'Incline_Cable_Flye', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('e140d744-1cd7-5930-bdce-8d4d033e5661', null, 'Développé debout (poulie)', 'developpe debout (poulie)', 'cable', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Place-toi dos aux poulies, une poignée dans chaque main, un pied en avant.
Pousse les mains devant toi jusqu''à l''extension des bras.
Reviens lentement en gardant le buste gainé.', 'Standing_Cable_Chest_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b1ebcf59-abd0-5050-b2fd-e3712a31ebf3', null, 'Développé couché (Smith)', 'developpe couche (smith)', 'machine', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Place le banc sous la barre guidée, yeux sous la barre.
Décroche la barre et descends-la vers le milieu de la poitrine.
Pousse jusqu''à l''extension des bras, puis raccroche en fin de série.', 'Smith_Machine_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b03a1a60-d1c6-5f10-8a73-ec4a39b3f571', null, 'Développé incliné (Smith)', 'developpe incline (smith)', 'machine', 'chest', array['shoulders', 'triceps']::text[], 'weight_reps', 'Règle le banc incliné sous la barre guidée.
Décroche la barre et descends-la vers le haut de la poitrine.
Pousse jusqu''à l''extension des bras, puis raccroche en fin de série.', 'Smith_Machine_Incline_Bench_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b44d1a62-8399-5cc0-a606-d6cfc10268b4', null, 'Pompes', 'pompes', 'bodyweight', 'chest', array['shoulders', 'triceps']::text[], 'bodyweight', 'Place-toi en appui sur les mains, un peu plus larges que les épaules, corps gainé.
Descends la poitrine près du sol, coudes à environ 45° du corps.
Pousse pour revenir bras tendus sans cambrer le dos.', 'Pushups', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f09f76cb-3eba-50a5-b153-fe35f3f73928', null, 'Pompes prise large', 'pompes prise large', 'bodyweight', 'chest', array['abs', 'shoulders', 'triceps']::text[], 'bodyweight', 'Place les mains nettement plus larges que les épaules, corps gainé.
Descends la poitrine près du sol en contrôlant.
Pousse pour revenir à la position de départ.', 'Push-Up_Wide', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('73dea6fd-ec78-5931-ad4d-6f6cbd28f19a', null, 'Pompes prise serrée', 'pompes prise serree', 'bodyweight', 'triceps', array['chest', 'shoulders']::text[], 'bodyweight', 'Place les mains rapprochées sous la poitrine, corps gainé.
Descends en gardant les coudes collés au corps.
Pousse jusqu''à l''extension des bras.', 'Push-Ups_-_Close_Triceps_Position', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('da5714f7-1b07-52c1-8900-414f5648cad3', null, 'Pompes pieds surélevés', 'pompes pieds sureleves', 'bodyweight', 'chest', array['shoulders', 'triceps']::text[], 'bodyweight', 'Pose les pieds sur un banc, mains au sol à la largeur des épaules.
Descends la poitrine près du sol, corps aligné.
Pousse jusqu''à l''extension des bras.', 'Push-Ups_With_Feet_Elevated', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('896dd1af-50dc-5658-b670-232733f0a9d2', null, 'Pompes mains surélevées', 'pompes mains surelevees', 'bodyweight', 'chest', array['shoulders', 'triceps']::text[], 'bodyweight', 'Pose les mains sur un banc ou une barre, corps aligné.
Descends la poitrine vers le support en contrôlant.
Pousse pour revenir bras tendus.', 'Incline_Push-Up', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5eca630d-5943-5bce-8cb7-6b35139eaf12', null, 'Dips pectoraux', 'dips pectoraux', 'bodyweight', 'chest', array['shoulders', 'triceps']::text[], 'weighted_bw', 'Saisis les barres parallèles, bras tendus, et penche légèrement le buste vers l''avant.
Descends jusqu''à ce que les épaules arrivent au niveau des coudes.
Pousse pour remonter bras tendus.', 'Dips_-_Chest_Version', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1fb17048-a632-558c-bc47-4a24f6d2a1a5', null, 'Pull-over (haltère)', 'pull-over (haltere)', 'dumbbell', 'chest', array['back', 'shoulders', 'triceps']::text[], 'weight_reps', 'Allonge-toi en travers du banc, un haltère tenu à deux mains au-dessus de la poitrine.
Descends-le derrière la tête, bras légèrement fléchis, jusqu''à l''étirement.
Ramène l''haltère au-dessus de la poitrine.', 'Bent-Arm_Dumbbell_Pullover', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1a8adf54-37b5-5036-b80f-3ca9a8f9ddf7', null, 'Tractions', 'tractions', 'bodyweight', 'back', array['biceps']::text[], 'weighted_bw', 'Saisis la barre en pronation, mains plus larges que les épaules.
Tire-toi jusqu''à passer le menton au-dessus de la barre.
Redescends lentement jusqu''aux bras tendus.', 'Pullups', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('54821df4-eebe-58d1-b5a7-346d54ee273a', null, 'Tractions supination', 'tractions supination', 'bodyweight', 'back', array['biceps', 'forearms']::text[], 'weighted_bw', 'Saisis la barre en supination, mains à la largeur des épaules.
Tire-toi jusqu''à passer le menton au-dessus de la barre.
Redescends lentement jusqu''aux bras tendus.', 'Chin-Up', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('a75921a0-8d6d-52ef-9bd8-8ca9305a8524', null, 'Tractions prise neutre', 'tractions prise neutre', 'bodyweight', 'back', array['biceps', 'shoulders']::text[], 'weighted_bw', 'Saisis les poignées parallèles, paumes face à face.
Tire-toi jusqu''à amener la poitrine près des mains.
Redescends lentement jusqu''aux bras tendus.', 'V-Bar_Pullup', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ece40e57-7113-5e87-9db1-f956afafacb7', null, 'Tractions assistées (élastique)', 'tractions assistees (elastique)', 'band', 'back', array['abs', 'forearms']::text[], 'assisted_bw', 'Passe un élastique autour de la barre et place un genou ou un pied dedans.
Tire-toi jusqu''à passer le menton au-dessus de la barre.
Redescends lentement jusqu''aux bras tendus.', 'Band_Assisted_Pull-Up', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('86967e2c-5e9f-581d-ae6f-1ec7473d1eda', null, 'Tirage vertical prise large (poulie)', 'tirage vertical prise large (poulie)', 'cable', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Assis, cuisses calées sous les rouleaux, saisis la barre large en pronation.
Tire la barre vers le haut de la poitrine en abaissant les coudes.
Remonte lentement jusqu''à l''étirement du dos.', 'Wide-Grip_Lat_Pulldown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9f399cff-22e2-597f-a47e-f41c571b1e51', null, 'Tirage vertical prise serrée (poulie)', 'tirage vertical prise serree (poulie)', 'cable', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Assis, cuisses calées, saisis la poignée prise serrée.
Tire vers le haut de la poitrine en gardant le buste droit.
Remonte de façon contrôlée.', 'Close-Grip_Front_Lat_Pulldown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('42cb03dc-d814-58b3-ae12-fa272de4cfea', null, 'Tirage vertical supination (poulie)', 'tirage vertical supination (poulie)', 'cable', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Assis, cuisses calées, saisis la barre en supination à la largeur des épaules.
Tire vers le haut de la poitrine en serrant les omoplates.
Remonte lentement jusqu''à l''extension des bras.', 'Underhand_Cable_Pulldowns', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('11bfc614-5a2e-5a2d-b35a-82c19ed6e534', null, 'Tirage vertical prise neutre (poulie)', 'tirage vertical prise neutre (poulie)', 'cable', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Assis, cuisses calées, saisis la poignée en V.
Tire vers le haut de la poitrine, coudes près du corps.
Remonte lentement jusqu''à l''étirement du dos.', 'V-Bar_Pulldown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4f04171b-d39a-57fc-b02e-07107fef3f1f', null, 'Tirage vertical à un bras (poulie)', 'tirage vertical a un bras (poulie)', 'cable', 'back', array['biceps']::text[], 'weight_reps', 'Assis face à la poulie haute, saisis la poignée d''une main.
Tire le coude vers la hanche en gardant le buste stable.
Remonte lentement jusqu''à l''étirement du dos.', 'One_Arm_Lat_Pulldown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('a5211380-4318-57d6-858e-57e7a4874a65', null, 'Pull-over à la poulie haute', 'pull-over a la poulie haute', 'cable', 'back', '{}'::text[], 'weight_reps', 'Debout face à la poulie haute, saisis la barre bras presque tendus.
Abaisse la barre jusqu''aux cuisses en gardant les bras tendus.
Remonte lentement jusqu''à l''étirement des dorsaux.', 'Straight-Arm_Pulldown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('08b989b4-8f2c-52fa-8913-7910b719c150', null, 'Tirage horizontal assis (poulie)', 'tirage horizontal assis (poulie)', 'cable', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Assis, pieds calés, saisis la poignée et garde le dos droit.
Tire la poignée vers le bas du ventre en serrant les omoplates.
Reviens lentement bras tendus sans arrondir le dos.', 'Seated_Cable_Rows', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('67206d5e-9513-5797-9384-f3d47307195a', null, 'Tirage horizontal à un bras (poulie)', 'tirage horizontal a un bras (poulie)', 'cable', 'back', array['biceps', 'traps']::text[], 'weight_reps', 'Assis face à la poulie basse, saisis la poignée d''une main.
Tire le coude vers l''arrière en serrant l''omoplate.
Reviens lentement bras tendu.', 'Seated_One-arm_Cable_Pulley_Rows', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('226d2852-69d9-5864-8b00-decc5ee68295', null, 'Rowing barre', 'rowing barre', 'barbell', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Penche le buste à environ 45°, dos plat, barre en pronation.
Tire la barre vers le bas du ventre en serrant les omoplates.
Redescends lentement sans arrondir le dos.', 'Bent_Over_Barbell_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5b6c4a86-f428-581b-9986-5f24b74e8aeb', null, 'Rowing barre supination', 'rowing barre supination', 'barbell', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Penche le buste, dos plat, barre en supination.
Tire la barre vers le bas du ventre, coudes près du corps.
Redescends de façon contrôlée.', 'Reverse_Grip_Bent-Over_Rows', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('7c74c79e-77db-54f6-8741-f3d8e16db818', null, 'Rowing un bras (haltère)', 'rowing un bras (haltere)', 'dumbbell', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Appuie un genou et une main sur le banc, dos à plat, haltère en main libre.
Tire l''haltère vers la hanche en gardant le coude près du corps.
Redescends lentement jusqu''à l''étirement.', 'One-Arm_Dumbbell_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('325ea77a-abf4-517b-b712-23a240c4250c', null, 'Rowing deux haltères', 'rowing deux halteres', 'dumbbell', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Penche le buste, dos plat, un haltère dans chaque main.
Tire les haltères vers les hanches en serrant les omoplates.
Redescends de façon contrôlée.', 'Bent_Over_Two-Dumbbell_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('8d748514-182f-5740-ba8d-b7352473ce62', null, 'Rowing sur banc incliné (haltères)', 'rowing sur banc incline (halteres)', 'dumbbell', 'back', array['biceps', 'forearms', 'shoulders']::text[], 'weight_reps', 'Allonge-toi face au banc incliné, un haltère dans chaque main.
Tire les haltères vers les hanches en serrant les omoplates.
Redescends lentement, bras tendus.', 'Dumbbell_Incline_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f9f2beff-b202-5aa6-858c-b71b4a0bd1af', null, 'Rowing T-bar (barre)', 'rowing t-bar (barre)', 'barbell', 'back', array['biceps']::text[], 'weight_reps', 'Place-toi au-dessus de la barre, dos plat, genoux légèrement fléchis.
Tire la poignée vers la poitrine en serrant les omoplates.
Redescends lentement sans arrondir le dos.', 'T-Bar_Row_with_Handle', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b6260057-59c3-52d2-ac09-ad10b91fdbb9', null, 'Rowing T-bar (machine)', 'rowing t-bar (machine)', 'machine', 'back', array['biceps']::text[], 'weight_reps', 'Allonge-toi la poitrine sur le support, saisis les poignées.
Tire les poignées vers toi en serrant les omoplates.
Reviens lentement bras tendus.', 'Lying_T-Bar_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('31bfd117-24bc-59ad-a4c0-b155b02a126c', null, 'Tirage haut convergent (machine)', 'tirage haut convergent (machine)', 'machine', 'back', '{}'::text[], 'weight_reps', 'Règle le siège et saisis les poignées hautes.
Tire vers toi en abaissant les coudes le long du corps.
Reviens lentement jusqu''à l''étirement du dos.', 'Leverage_High_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d89c58a4-d812-58f3-a3da-496673975762', null, 'Rowing convergent (machine)', 'rowing convergent (machine)', 'machine', 'back', array['biceps']::text[], 'weight_reps', 'Cale la poitrine contre le support et saisis les poignées.
Tire les coudes vers l''arrière en serrant les omoplates.
Reviens lentement bras tendus.', 'Leverage_Iso_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d81c6044-9b01-52f8-ad5b-5fa86fa1ee43', null, 'Rowing inversé', 'rowing inverse', 'bodyweight', 'back', '{}'::text[], 'bodyweight', 'Allonge-toi sous une barre fixe, saisis-la en pronation, corps gainé.
Tire la poitrine vers la barre en serrant les omoplates.
Redescends lentement bras tendus.', 'Inverted_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('23f558b3-c854-5b5e-ae2d-69775c3c692d', null, 'Rowing suspendu (sangles)', 'rowing suspendu (sangles)', 'other', 'back', array['biceps']::text[], 'bodyweight', 'Saisis les poignées des sangles, corps incliné en arrière et gainé.
Tire la poitrine vers les mains en serrant les omoplates.
Redescends lentement bras tendus.', 'Suspended_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('11fb72a9-a004-577a-ae9d-6533c9e87552', null, 'Rowing barre (Smith)', 'rowing barre (smith)', 'machine', 'back', array['biceps', 'shoulders']::text[], 'weight_reps', 'Penche le buste, dos plat, barre guidée en pronation.
Tire la barre vers le bas du ventre.
Redescends de façon contrôlée.', 'Smith_Machine_Bent_Over_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ab5d3ed0-59bc-5489-8367-9b5546746cf6', null, 'Face pull (poulie)', 'face pull (poulie)', 'cable', 'shoulders', array['back']::text[], 'weight_reps', 'Règle la poulie à hauteur du visage avec la corde.
Tire la corde vers le visage en écartant les mains.
Reviens lentement bras tendus.', 'Face_Pull', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b58edd26-4029-5e74-a36a-c3ed861878b7', null, 'Développé militaire (barre)', 'developpe militaire (barre)', 'barbell', 'shoulders', array['triceps']::text[], 'weight_reps', 'Debout, barre sur le haut de la poitrine, abdos et fessiers gainés.
Pousse la barre à la verticale jusqu''à l''extension des bras.
Redescends lentement sur le haut de la poitrine.', 'Standing_Military_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f8e13de3-ac22-597d-af32-7eca2d3ccc24', null, 'Développé militaire assis (barre)', 'developpe militaire assis (barre)', 'barbell', 'shoulders', array['triceps']::text[], 'weight_reps', 'Assis dos calé, barre au niveau du menton, mains un peu plus larges que les épaules.
Pousse la barre jusqu''à l''extension des bras.
Redescends de façon contrôlée.', 'Seated_Barbell_Military_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f784a3c6-6c88-5800-b45f-55f0c13bc096', null, 'Push press (barre)', 'push press (barre)', 'barbell', 'shoulders', array['quads', 'triceps']::text[], 'weight_reps', 'Debout, barre sur le haut de la poitrine, jambes légèrement fléchies.
Donne une impulsion des jambes et pousse la barre au-dessus de la tête.
Redescends la barre en amortissant avec les jambes.', 'Push_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5f195802-b487-530d-9b81-09bdab9b04c9', null, 'Développé épaules (haltères)', 'developpe epaules (halteres)', 'dumbbell', 'shoulders', array['triceps']::text[], 'weight_reps', 'Assis dos calé, haltères à hauteur d''épaules.
Pousse-les vers le haut jusqu''à l''extension des bras.
Redescends lentement à hauteur des oreilles.', 'Dumbbell_Shoulder_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1a1815d8-7ab3-5e1f-8869-f867a6b7825e', null, 'Développé Arnold', 'developpe arnold', 'dumbbell', 'shoulders', array['triceps']::text[], 'weight_reps', 'Assis, haltères devant toi, paumes vers le visage.
Pousse vers le haut en tournant les paumes vers l''avant.
Redescends en inversant la rotation.', 'Arnold_Dumbbell_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('40ef8ce9-3a28-5142-ba5c-717a23458d55', null, 'Développé épaules (machine)', 'developpe epaules (machine)', 'machine', 'shoulders', array['triceps']::text[], 'weight_reps', 'Règle le siège pour que les poignées soient à hauteur d''épaules.
Pousse vers le haut jusqu''à l''extension des bras.
Redescends lentement.', 'Machine_Shoulder_Military_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fafc5b35-4571-5c36-8ce1-0cc1734e444e', null, 'Développé épaules (Smith)', 'developpe epaules (smith)', 'machine', 'shoulders', array['triceps']::text[], 'weight_reps', 'Assis ou debout sous la barre guidée, mains un peu plus larges que les épaules.
Pousse jusqu''à l''extension des bras.
Redescends la barre au niveau du menton.', 'Smith_Machine_Overhead_Shoulder_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ad12b7e0-1c55-5337-bd53-7f3bbccd87e9', null, 'Élévations latérales (haltères)', 'elevations laterales (halteres)', 'dumbbell', 'shoulders', '{}'::text[], 'weight_reps', 'Debout, un haltère dans chaque main, bras le long du corps.
Monte les bras sur les côtés jusqu''à hauteur d''épaules, coudes légèrement fléchis.
Redescends lentement sans élan.', 'Side_Lateral_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3506d344-e923-57e4-bde2-66bb12f7199d', null, 'Élévations latérales assis (haltères)', 'elevations laterales assis (halteres)', 'dumbbell', 'shoulders', '{}'::text[], 'weight_reps', 'Assis sur un banc, un haltère dans chaque main.
Monte les bras sur les côtés jusqu''à hauteur d''épaules.
Redescends lentement sans élan.', 'Seated_Side_Lateral_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5d8ca2fa-ed52-50f4-86d9-f8b74e892d31', null, 'Élévation latérale (poulie basse)', 'elevation laterale (poulie basse)', 'cable', 'shoulders', array['forearms']::text[], 'weight_reps', 'Debout de côté par rapport à la poulie basse, poignée dans la main opposée.
Monte le bras sur le côté jusqu''à hauteur d''épaule.
Redescends lentement en gardant la tension.', 'Standing_Low-Pulley_Deltoid_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1aaf7eab-7411-5b15-bc42-645b6c532a67', null, 'Élévations frontales (haltères)', 'elevations frontales (halteres)', 'dumbbell', 'shoulders', '{}'::text[], 'weight_reps', 'Debout, haltères devant les cuisses.
Monte un bras devant toi jusqu''à hauteur d''épaule.
Redescends lentement et alterne.', 'Front_Dumbbell_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('39722103-2f7f-5f43-b1a6-22c0a8623015', null, 'Élévation frontale (poulie)', 'elevation frontale (poulie)', 'cable', 'shoulders', '{}'::text[], 'weight_reps', 'Dos à la poulie basse, saisis la poignée entre les jambes.
Monte le bras devant toi jusqu''à hauteur d''épaule.
Redescends lentement.', 'Front_Cable_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3704aa2a-f20d-59a6-b4a1-7d63c0347933', null, 'Élévation frontale (disque)', 'elevation frontale (disque)', 'other', 'shoulders', '{}'::text[], 'weight_reps', 'Debout, tiens un disque à deux mains devant les cuisses.
Monte-le devant toi jusqu''à hauteur d''yeux, bras presque tendus.
Redescends lentement.', 'Front_Plate_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f692936e-0059-50cd-987c-d3208b41d8c7', null, 'Oiseau (haltères)', 'oiseau (halteres)', 'dumbbell', 'shoulders', '{}'::text[], 'weight_reps', 'Penche le buste, dos plat, un haltère dans chaque main.
Écarte les bras sur les côtés jusqu''à hauteur d''épaules.
Redescends lentement sans balancer le buste.', 'Reverse_Flyes', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('0fa75739-59bf-556b-bfdf-97eb5707c3c8', null, 'Oiseau (machine)', 'oiseau (machine)', 'machine', 'shoulders', '{}'::text[], 'weight_reps', 'Assis face au dossier, saisis les poignées bras tendus devant toi.
Écarte les bras vers l''arrière en serrant les omoplates.
Reviens lentement.', 'Reverse_Machine_Flyes', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('7b10b18c-773f-575d-939c-35bb749c1115', null, 'Oiseau (poulie)', 'oiseau (poulie)', 'cable', 'shoulders', '{}'::text[], 'weight_reps', 'Place-toi entre deux poulies hautes, poignées croisées.
Écarte les bras sur les côtés à hauteur d''épaules.
Reviens lentement en gardant la tension.', 'Cable_Rear_Delt_Fly', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b541af26-bbdf-59f6-b84c-c79d1d1ecb39', null, 'Tirage menton (barre)', 'tirage menton (barre)', 'barbell', 'shoulders', array['traps']::text[], 'weight_reps', 'Debout, barre devant les cuisses, mains un peu plus étroites que les épaules.
Monte la barre le long du corps jusqu''au menton, coudes vers le haut.
Redescends lentement.', 'Upright_Barbell_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('dd72d62c-5b38-5af8-8022-1b56757e2180', null, 'Écartement d''élastique', 'ecartement d''elastique', 'band', 'shoulders', array['back', 'traps']::text[], 'bodyweight', 'Tiens l''élastique devant toi, bras tendus à hauteur d''épaules.
Écarte les bras jusqu''à ce que l''élastique touche la poitrine.
Reviens lentement.', 'Band_Pull_Apart', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('46cb8777-def1-52c1-890a-5691ccff3958', null, 'Élévations latérales (élastique)', 'elevations laterales (elastique)', 'band', 'shoulders', '{}'::text[], 'bodyweight', 'Place l''élastique sous les pieds et saisis-le dans chaque main.
Monte les bras sur les côtés jusqu''à hauteur d''épaules.
Redescends lentement.', 'Lateral_Raise_-_With_Bands', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('aa37fbbb-a325-57e2-9ac4-0eac6f7a34ab', null, 'Pompes en équilibre (ATR)', 'pompes en equilibre (atr)', 'bodyweight', 'shoulders', array['triceps']::text[], 'bodyweight', 'Place-toi en équilibre sur les mains contre un mur, corps aligné.
Descends la tête vers le sol en contrôlant.
Pousse jusqu''à l''extension des bras.', 'Handstand_Push-Ups', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('6258eda0-58c7-53dc-b402-8ac38e417f18', null, 'Rotation externe (poulie)', 'rotation externe (poulie)', 'cable', 'shoulders', '{}'::text[], 'weight_reps', 'Debout de côté, poulie à hauteur du coude, coude collé au corps à 90°.
Tourne l''avant-bras vers l''extérieur sans bouger le coude.
Reviens lentement.', 'External_Rotation_with_Cable', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('60acb4b3-ba3f-586c-bd01-312e51438748', null, 'Shrugs (barre)', 'shrugs (barre)', 'barbell', 'traps', '{}'::text[], 'weight_reps', 'Debout, barre devant les cuisses, bras tendus.
Hausse les épaules vers les oreilles sans fléchir les bras.
Redescends lentement.', 'Barbell_Shrug', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f93eb734-7661-54da-9f30-fc71efa5cc2f', null, 'Shrugs (haltères)', 'shrugs (halteres)', 'dumbbell', 'traps', '{}'::text[], 'weight_reps', 'Debout, un haltère dans chaque main, bras le long du corps.
Hausse les épaules vers les oreilles sans fléchir les bras.
Redescends lentement.', 'Dumbbell_Shrug', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('21d75d1b-8cf6-57da-8740-877d03261aa2', null, 'Shrugs (poulie)', 'shrugs (poulie)', 'cable', 'traps', '{}'::text[], 'weight_reps', 'Debout face à la poulie basse, barre en main.
Hausse les épaules vers les oreilles.
Redescends lentement.', 'Cable_Shrugs', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('afac28e3-9db9-543d-8988-2132cfe673a2', null, 'Shrugs (machine)', 'shrugs (machine)', 'machine', 'traps', array['forearms']::text[], 'weight_reps', 'Place-toi dans la machine, poignées en main, bras tendus.
Hausse les épaules vers les oreilles.
Redescends lentement.', 'Leverage_Shrug', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b9eb8280-0fb8-5fe7-b456-8d42398e80bc', null, 'Tractions scapulaires', 'tractions scapulaires', 'bodyweight', 'traps', array['back']::text[], 'bodyweight', 'Suspends-toi à la barre, bras tendus.
Abaisse les omoplates pour te hisser de quelques centimètres, sans plier les coudes.
Relâche lentement.', 'Scapular_Pull-Up', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9ad0a808-c901-5e9d-90da-48c5ec3a291c', null, 'Curl biceps (barre)', 'curl biceps (barre)', 'barbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Debout, barre en supination, coudes collés au corps.
Monte la barre vers les épaules sans balancer le buste.
Redescends lentement jusqu''à l''extension complète.', 'Barbell_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1f9fad84-4617-52f9-be85-ca9df81108dc', null, 'Curl biceps (barre EZ)', 'curl biceps (barre ez)', 'barbell', 'biceps', '{}'::text[], 'weight_reps', 'Debout, saisis la barre EZ sur les courbes, coudes collés au corps.
Monte la barre vers les épaules sans balancer.
Redescends lentement.', 'EZ-Bar_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('64ae82a4-9dc3-5e34-ba3f-09a7a0569a0d', null, 'Curl prise large (barre)', 'curl prise large (barre)', 'barbell', 'biceps', '{}'::text[], 'weight_reps', 'Debout, barre en supination, mains plus larges que les épaules.
Monte la barre vers les épaules, coudes fixes.
Redescends lentement.', 'Wide-Grip_Standing_Barbell_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2f9c1b30-5982-5568-9f7b-13f9847988fe', null, 'Curl pupitre (barre)', 'curl pupitre (barre)', 'barbell', 'biceps', '{}'::text[], 'weight_reps', 'Cale les bras sur le pupitre, barre en supination.
Monte la barre vers les épaules.
Redescends lentement jusqu''à l''extension sans décoller le pupitre.', 'Preacher_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('db781e5f-3855-5923-a1a8-1b3541c4f4df', null, 'Curl biceps (haltères)', 'curl biceps (halteres)', 'dumbbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Debout, un haltère dans chaque main, paumes vers l''avant.
Monte les haltères vers les épaules, coudes collés au corps.
Redescends lentement.', 'Dumbbell_Bicep_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('e5c6bcb3-e78e-5926-9c32-c4da9c1bf20b', null, 'Curl alterné (haltères)', 'curl alterne (halteres)', 'dumbbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Debout, un haltère dans chaque main, paumes vers l''avant.
Monte un bras vers l''épaule en tournant le poignet.
Redescends lentement puis alterne.', 'Dumbbell_Alternate_Bicep_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('36c456eb-3871-5b29-bc72-3ecef2bab02b', null, 'Curl marteau (haltères)', 'curl marteau (halteres)', 'dumbbell', 'biceps', '{}'::text[], 'weight_reps', 'Debout, haltères en prise neutre, paumes face à face.
Monte les haltères vers les épaules, coudes fixes.
Redescends lentement.', 'Hammer_Curls', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2b7701b2-8c75-518e-b768-2ced0e8b2d81', null, 'Curl incliné (haltères)', 'curl incline (halteres)', 'dumbbell', 'biceps', '{}'::text[], 'weight_reps', 'Assis sur un banc incliné, bras pendants, un haltère dans chaque main.
Monte les haltères sans avancer les coudes.
Redescends lentement jusqu''à l''étirement.', 'Incline_Dumbbell_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3c20bd35-3afc-53af-ac59-3b29484d2d3f', null, 'Curl concentré (haltère)', 'curl concentre (haltere)', 'dumbbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Assis, coude appuyé contre l''intérieur de la cuisse, haltère en main.
Monte l''haltère vers l''épaule.
Redescends lentement.', 'Concentration_Curls', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fc8c45b2-dd09-5c59-bce6-43526ecac2b1', null, 'Curl pupitre un bras (haltère)', 'curl pupitre un bras (haltere)', 'dumbbell', 'biceps', '{}'::text[], 'weight_reps', 'Cale le bras sur le pupitre, haltère en supination.
Monte l''haltère vers l''épaule.
Redescends lentement jusqu''à l''extension.', 'One_Arm_Dumbbell_Preacher_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('cbb01a3a-f502-5f3d-b5f3-2db256603a2a', null, 'Curl Zottman', 'curl zottman', 'dumbbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Monte les haltères paumes vers l''avant, comme un curl classique.
Tourne les poignets en haut, paumes vers le bas.
Redescends lentement, puis tourne les poignets pour recommencer.', 'Zottman_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('416a8b44-222d-5769-af0b-1d22f08671bd', null, 'Curl marteau croisé', 'curl marteau croise', 'dumbbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Debout, haltères en prise neutre.
Monte un haltère en diagonale vers l''épaule opposée.
Redescends lentement et alterne.', 'Cross_Body_Hammer_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2d3f7a35-4ef8-5413-acce-89c0f8cdddb1', null, 'Curl biceps (poulie)', 'curl biceps (poulie)', 'cable', 'biceps', '{}'::text[], 'weight_reps', 'Face à la poulie basse, saisis la barre en supination.
Monte la barre vers les épaules, coudes collés au corps.
Redescends lentement.', 'Standing_Biceps_Cable_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fb78d1d7-07bd-5cdb-a6d5-f2d1e27b1e08', null, 'Curl marteau (corde, poulie)', 'curl marteau (corde, poulie)', 'cable', 'biceps', '{}'::text[], 'weight_reps', 'Face à la poulie basse, saisis la corde en prise neutre.
Monte les mains vers les épaules, coudes fixes.
Redescends lentement.', 'Cable_Hammer_Curls_-_Rope_Attachment', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fe5919ef-40b8-5003-8671-3696cce306a1', null, 'Curl poulies hautes', 'curl poulies hautes', 'cable', 'biceps', '{}'::text[], 'weight_reps', 'Place-toi entre deux poulies hautes, bras écartés à hauteur d''épaules.
Fléchis les coudes pour amener les poignées près des oreilles.
Reviens lentement.', 'High_Cable_Curls', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('c2f2bc2b-62b6-5e1c-b17c-b62b53ba1192', null, 'Curl pupitre (poulie)', 'curl pupitre (poulie)', 'cable', 'biceps', array['forearms']::text[], 'weight_reps', 'Cale les bras sur le pupitre devant la poulie basse.
Monte la barre vers les épaules.
Redescends lentement.', 'Cable_Preacher_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1b5e24c3-96a5-5bac-b2c7-b1f141e44881', null, 'Curl biceps (machine)', 'curl biceps (machine)', 'machine', 'biceps', '{}'::text[], 'weight_reps', 'Règle le siège pour aligner les coudes avec l''axe de la machine.
Monte les poignées vers les épaules.
Redescends lentement.', 'Machine_Bicep_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('90de0bf4-3da6-5a72-93f1-2c7e91865982', null, 'Curl pupitre (machine)', 'curl pupitre (machine)', 'machine', 'biceps', '{}'::text[], 'weight_reps', 'Cale les bras sur le support de la machine.
Fléchis les coudes pour monter les poignées.
Redescends lentement jusqu''à l''extension.', 'Machine_Preacher_Curls', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('09b200ff-f8fc-56aa-b70f-e81bbfdb757b', null, 'Curl inversé (barre)', 'curl inverse (barre)', 'barbell', 'biceps', array['forearms']::text[], 'weight_reps', 'Debout, barre en pronation, coudes collés au corps.
Monte la barre vers les épaules, poignets neutres.
Redescends lentement.', 'Reverse_Barbell_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b9ba0238-70b3-5597-9970-78f3550e642a', null, 'Extension triceps à la poulie (barre)', 'extension triceps a la poulie (barre)', 'cable', 'triceps', '{}'::text[], 'weight_reps', 'Face à la poulie haute, saisis la barre, coudes collés au corps.
Pousse vers le bas jusqu''à l''extension des bras.
Remonte lentement sans bouger les coudes.', 'Triceps_Pushdown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f2a18063-b583-5fc2-808e-9a852e7326b0', null, 'Extension triceps à la poulie (corde)', 'extension triceps a la poulie (corde)', 'cable', 'triceps', '{}'::text[], 'weight_reps', 'Face à la poulie haute, saisis la corde, coudes collés au corps.
Pousse vers le bas en écartant la corde en fin de mouvement.
Remonte lentement.', 'Triceps_Pushdown_-_Rope_Attachment', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1acae04e-7b8e-5e80-8adc-304733efae2e', null, 'Extension triceps à la poulie (barre en V)', 'extension triceps a la poulie (barre en v)', 'cable', 'triceps', '{}'::text[], 'weight_reps', 'Face à la poulie haute, saisis la barre en V, coudes collés.
Pousse vers le bas jusqu''à l''extension des bras.
Remonte lentement.', 'Triceps_Pushdown_-_V-Bar_Attachment', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('117ec387-fe3e-5d58-92c1-8e136ad38b0a', null, 'Extension triceps à la poulie (supination)', 'extension triceps a la poulie (supination)', 'cable', 'triceps', '{}'::text[], 'weight_reps', 'Face à la poulie haute, saisis la barre en supination.
Pousse vers le bas jusqu''à l''extension, coudes fixes.
Remonte lentement.', 'Reverse_Grip_Triceps_Pushdown', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3edb0a62-840b-5537-91e8-791eb3c61029', null, 'Extension triceps au-dessus de la tête (corde)', 'extension triceps au-dessus de la tete (corde)', 'cable', 'triceps', '{}'::text[], 'weight_reps', 'Dos à la poulie, corde derrière la tête, coudes vers l''avant.
Étends les bras vers l''avant et le haut.
Reviens lentement derrière la tête.', 'Triceps_Overhead_Extension_with_Rope', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ed6e7517-a38b-58e2-96c7-d28d87defc24', null, 'Extension triceps un bras (poulie)', 'extension triceps un bras (poulie)', 'cable', 'triceps', '{}'::text[], 'weight_reps', 'Face à la poulie haute, saisis la poignée d''une main, coude collé.
Étends le bras vers le bas.
Remonte lentement.', 'Cable_One_Arm_Tricep_Extension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('42c8fe06-d20c-5721-b401-214001e9aba0', null, 'Barre au front (barre EZ)', 'barre au front (barre ez)', 'barbell', 'triceps', array['forearms']::text[], 'weight_reps', 'Allongé sur le banc, barre EZ au-dessus de la poitrine, bras tendus.
Fléchis les coudes pour amener la barre vers le front.
Étends les bras sans écarter les coudes.', 'EZ-Bar_Skullcrusher', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('32f6cf22-1142-5143-b621-8410a8d924d9', null, 'Extension triceps couché (haltères)', 'extension triceps couche (halteres)', 'dumbbell', 'triceps', array['chest', 'shoulders']::text[], 'weight_reps', 'Allongé, haltères au-dessus de la poitrine, bras tendus.
Fléchis les coudes pour amener les haltères près de la tête.
Étends les bras en gardant les coudes fixes.', 'Lying_Dumbbell_Tricep_Extension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4e9f1009-1ee3-52f6-acf6-313c395f27ac', null, 'Extension triceps nuque (haltère)', 'extension triceps nuque (haltere)', 'dumbbell', 'triceps', '{}'::text[], 'weight_reps', 'Debout, tiens un haltère à deux mains au-dessus de la tête.
Fléchis les coudes pour descendre l''haltère derrière la nuque.
Étends les bras vers le haut.', 'Standing_Dumbbell_Triceps_Extension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('32e3490c-617e-5302-9162-a54ae68eb62f', null, 'Extension triceps assis (haltère)', 'extension triceps assis (haltere)', 'dumbbell', 'triceps', '{}'::text[], 'weight_reps', 'Assis, tiens un haltère à deux mains au-dessus de la tête.
Descends-le derrière la nuque en gardant les coudes serrés.
Remonte jusqu''à l''extension des bras.', 'Seated_Triceps_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('74c27ce4-fffe-5573-b6a7-2048955f3b1f', null, 'Kickback triceps (haltère)', 'kickback triceps (haltere)', 'dumbbell', 'triceps', '{}'::text[], 'weight_reps', 'Penché en avant, coude collé au corps à 90°, haltère en main.
Étends le bras vers l''arrière.
Reviens lentement à 90°.', 'Tricep_Dumbbell_Kickback', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('c2b1c1ae-0a08-52e8-abdf-fda44794ab89', null, 'Extension nuque debout (barre)', 'extension nuque debout (barre)', 'barbell', 'triceps', array['shoulders']::text[], 'weight_reps', 'Debout, barre tenue au-dessus de la tête, bras tendus.
Descends-la derrière la nuque en fléchissant les coudes.
Remonte jusqu''à l''extension.', 'Standing_Overhead_Barbell_Triceps_Extension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('bdc46b41-03f4-52fc-a40d-5d479f1e4e15', null, 'Extension triceps (machine)', 'extension triceps (machine)', 'machine', 'triceps', '{}'::text[], 'weight_reps', 'Règle le siège, coudes calés sur le support.
Étends les bras jusqu''à l''extension complète.
Reviens lentement.', 'Machine_Triceps_Extension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('878d90b7-facb-546a-a5fd-15d127ef46e1', null, 'Dips (machine)', 'dips (machine)', 'machine', 'triceps', array['chest', 'shoulders']::text[], 'weight_reps', 'Assis, saisis les poignées, coudes près du corps.
Pousse vers le bas jusqu''à l''extension des bras.
Reviens lentement.', 'Dip_Machine', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('97f7f5a1-6a79-5d5b-818d-38e4f27aaaa0', null, 'Dips sur banc', 'dips sur banc', 'bodyweight', 'triceps', array['chest', 'shoulders']::text[], 'bodyweight', 'Mains sur le banc derrière toi, jambes tendues devant.
Descends en fléchissant les coudes jusqu''à environ 90°.
Pousse pour remonter.', 'Bench_Dips', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('e8d80210-513e-5e75-95dc-465a619abadf', null, 'Dips triceps', 'dips triceps', 'bodyweight', 'triceps', array['chest', 'shoulders']::text[], 'weighted_bw', 'Saisis les barres parallèles, buste droit et coudes près du corps.
Descends jusqu''à environ 90° au coude.
Pousse pour remonter bras tendus.', 'Dips_-_Triceps_Version', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b7541a32-30e9-566e-96a2-d266a0231bb4', null, 'Développé haltères prise serrée', 'developpe halteres prise serree', 'dumbbell', 'triceps', array['chest', 'shoulders']::text[], 'weight_reps', 'Allongé, haltères collés l''un contre l''autre au-dessus de la poitrine.
Descends-les vers la poitrine, coudes près du corps.
Pousse jusqu''à l''extension des bras.', 'Close-Grip_Dumbbell_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('17b4104e-0e17-5fd4-985f-9505b1c66c02', null, 'Curl poignets (barre)', 'curl poignets (barre)', 'barbell', 'forearms', '{}'::text[], 'weight_reps', 'Assis, avant-bras posés sur un banc, paumes vers le haut.
Laisse la barre rouler jusqu''au bout des doigts.
Remonte-la en fléchissant les poignets.', 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('04753572-e0eb-5280-8837-e353f80aa022', null, 'Extension poignets (barre)', 'extension poignets (barre)', 'barbell', 'forearms', '{}'::text[], 'weight_reps', 'Assis, avant-bras posés sur un banc, paumes vers le bas.
Descends la barre en fléchissant les poignets.
Remonte en étendant les poignets.', 'Palms-Down_Wrist_Curl_Over_A_Bench', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ccd11cfe-6d82-582d-a4f1-77cf5813f2d9', null, 'Curl poignets (haltères)', 'curl poignets (halteres)', 'dumbbell', 'forearms', '{}'::text[], 'weight_reps', 'Assis, avant-bras sur les cuisses, haltères paumes vers le haut.
Descends les haltères, puis remonte-les en fléchissant les poignets.
Garde les avant-bras immobiles.', 'Seated_Dumbbell_Palms-Up_Wrist_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b834d535-7c14-587d-b29d-a7784bed4e31', null, 'Curl poignets (poulie)', 'curl poignets (poulie)', 'cable', 'forearms', '{}'::text[], 'weight_reps', 'Assis face à la poulie basse, avant-bras sur les cuisses.
Fléchis les poignets pour monter la poignée.
Redescends lentement.', 'Cable_Wrist_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('07f53c03-4715-5886-af0f-7116622ed226', null, 'Marche du fermier', 'marche du fermier', 'other', 'forearms', array['abs', 'glutes', 'hamstrings', 'lower_back']::text[], 'weight_duration', 'Saisis un haltère lourd dans chaque main, bras le long du corps.
Marche en gardant le buste droit et les épaules basses.
Pose les charges en contrôlant à la fin.', 'Farmers_Walk', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9729fb7d-1071-537f-a347-84b1f76bdb72', null, 'Enrouleur d''avant-bras', 'enrouleur d''avant-bras', 'other', 'forearms', array['shoulders']::text[], 'weight_reps', 'Debout, bras tendus devant toi, tiens la barre de l''enrouleur.
Enroule la corde en tournant les poignets pour monter la charge.
Redescends la charge lentement.', 'Wrist_Roller', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2c8d98f7-eeef-5652-b345-db9a6a5acc6a', null, 'Pincé de disques', 'pince de disques', 'other', 'forearms', '{}'::text[], 'weight_duration', 'Pince deux disques lisses face contre face entre les doigts et le pouce.
Maintiens la prise le plus longtemps possible, bras le long du corps.
Repose les disques en contrôlant.', 'Plate_Pinch', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('65895372-5ddd-5e0d-9184-e23ca969c4cb', null, 'Crunch', 'crunch', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur le dos, genoux fléchis, mains près des tempes.
Enroule le haut du dos pour décoller les omoplates.
Redescends lentement sans tirer sur la nuque.', 'Crunches', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('c6daa2e8-603b-5e2f-b85b-a8309d4e2a67', null, 'Crunch à la poulie', 'crunch a la poulie', 'cable', 'abs', '{}'::text[], 'weight_reps', 'À genoux face à la poulie haute, corde tenue près de la tête.
Enroule le buste vers le bas en rapprochant les coudes des genoux.
Remonte lentement.', 'Cable_Crunch', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('7613f83d-8dd7-5348-af8b-e89ccdbb4cb3', null, 'Crunch (machine)', 'crunch (machine)', 'machine', 'abs', '{}'::text[], 'weight_reps', 'Règle le siège et saisis les poignées.
Enroule le buste vers l''avant en contractant les abdos.
Reviens lentement.', 'Ab_Crunch_Machine', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b51cd1af-c12b-5143-9d3b-b234d1fd6367', null, 'Crunch sur banc décliné', 'crunch sur banc decline', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur le banc décliné, pieds calés, mains près des tempes.
Enroule le buste vers les genoux.
Redescends lentement.', 'Decline_Crunch', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('8f2cfb66-243a-5a7d-8873-5b07a96fb73d', null, 'Crunch inversé', 'crunch inverse', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur le dos, jambes fléchies en l''air.
Rapproche les genoux de la poitrine en décollant le bassin.
Redescends lentement.', 'Reverse_Crunch', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9501f28b-d68a-5d1b-9b2a-8a8494eee39e', null, 'Relevé de jambes suspendu', 'releve de jambes suspendu', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Suspends-toi à la barre, bras tendus.
Monte les jambes jusqu''à l''horizontale ou plus haut sans balancer.
Redescends lentement.', 'Hanging_Leg_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('adeb6fa8-cd96-5a0e-a68f-f75c154823c2', null, 'Relevé de genoux (chaise romaine)', 'releve de genoux (chaise romaine)', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Appuie-toi sur les avant-bras, dos plaqué contre le dossier.
Monte les genoux vers la poitrine.
Redescends lentement sans balancer.', 'Knee_Hip_Raise_On_Parallel_Bars', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('a036aba7-4492-581e-ac07-97d34fd05dcf', null, 'Relevé de jambes allongé', 'releve de jambes allonge', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur un banc, mains sous les fessiers, jambes tendues.
Monte les jambes à la verticale.
Redescends lentement sans toucher le sol.', 'Flat_Bench_Lying_Leg_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('52ce4c95-8a83-5940-89e2-a6eff709f5c3', null, 'Relevé de buste (sit-up)', 'releve de buste (sit-up)', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur le dos, genoux fléchis, pieds au sol.
Relève le buste jusqu''à la position assise.
Redescends lentement.', 'Sit-Up', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('e415b9e5-8da2-597e-b537-1156920f6079', null, 'Russian twist', 'russian twist', 'bodyweight', 'abs', array['lower_back']::text[], 'bodyweight', 'Assis, buste incliné en arrière, pieds décollés.
Tourne le buste d''un côté puis de l''autre.
Garde le dos droit pendant tout le mouvement.', 'Russian_Twist', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('580627cc-e230-58d1-98d5-5a3e90a620f9', null, 'Gainage (planche)', 'gainage (planche)', 'bodyweight', 'abs', '{}'::text[], 'duration', 'Appuie-toi sur les avant-bras et la pointe des pieds.
Aligne la tête, le dos et les jambes, abdos contractés.
Tiens la position sans cambrer ni creuser le dos.', 'Plank', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b739ec03-d8d0-5312-838f-3dcc66890a06', null, 'Gainage latéral', 'gainage lateral', 'bodyweight', 'abs', array['shoulders']::text[], 'duration', 'Allongé sur le côté, appui sur l''avant-bras, coude sous l''épaule.
Soulève le bassin pour aligner épaules, hanches et pieds.
Tiens la position, puis change de côté.', 'Side_Bridge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('00a60ad6-6f60-52e0-bdf3-04bd058a1f43', null, 'Roue abdominale', 'roue abdominale', 'other', 'abs', array['shoulders']::text[], 'bodyweight', 'À genoux, saisis la roue à deux mains sous les épaules.
Roule vers l''avant en gardant le dos plat et les abdos gainés.
Reviens en contractant les abdos.', 'Ab_Roller', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('54759688-e3ca-5ddb-a7b5-cca69be342c4', null, 'Dead bug', 'dead bug', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur le dos, bras tendus vers le plafond, genoux à 90°.
Étends le bras et la jambe opposés vers le sol sans cambrer.
Reviens et alterne.', 'Dead_Bug', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fc0fe265-d174-5822-bff1-3fbfd6ae183e', null, 'Mountain climbers', 'mountain climbers', 'bodyweight', 'quads', array['chest', 'hamstrings', 'shoulders']::text[], 'duration', 'Place-toi en position de pompe, bras tendus.
Ramène alternativement un genou vers la poitrine.
Garde le bassin bas et le rythme régulier.', 'Mountain_Climbers', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('24b09810-9b28-516d-abf5-47c965b641c6', null, 'Bûcheron (poulie)', 'bucheron (poulie)', 'cable', 'abs', array['shoulders']::text[], 'weight_reps', 'Debout de côté, poulie haute, saisis la poignée à deux mains.
Tire en diagonale vers le bas en pivotant le buste.
Reviens lentement.', 'Standing_Cable_Wood_Chop', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('0b8cfa25-ca32-5b40-be36-77183a2394b1', null, 'Pallof press', 'pallof press', 'cable', 'abs', array['chest', 'shoulders', 'triceps']::text[], 'weight_reps', 'Debout de côté à la poulie, poignée contre la poitrine.
Tends les bras devant toi en résistant à la rotation.
Reviens lentement.', 'Pallof_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ac405dae-fabe-5876-b511-6762e9d14efc', null, 'Flexion latérale (haltère)', 'flexion laterale (haltere)', 'dumbbell', 'abs', '{}'::text[], 'weight_reps', 'Debout, un haltère dans une main, l''autre main derrière la tête.
Incline le buste vers le côté de l''haltère.
Reviens à la verticale en contractant les obliques.', 'Dumbbell_Side_Bend', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('dbdb7999-5fe5-592d-a71f-f55b7664e304', null, 'Vélo abdominal', 'velo abdominal', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé sur le dos, mains près des tempes, jambes en l''air.
Rapproche un coude du genou opposé en pédalant.
Alterne en gardant le rythme.', 'Air_Bike', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d5af369b-669d-5d92-b187-56037a596cb1', null, 'Crunch oblique', 'crunch oblique', 'bodyweight', 'abs', '{}'::text[], 'bodyweight', 'Allongé, genoux fléchis, mains près des tempes.
Rapproche un coude du genou opposé.
Redescends lentement et alterne.', 'Oblique_Crunches', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2cdcac62-0f54-5a9b-b366-b7e05a993741', null, 'Crunch sur ballon', 'crunch sur ballon', 'other', 'abs', '{}'::text[], 'bodyweight', 'Allonge-toi sur le ballon, dos arrondi, pieds au sol.
Enroule le buste vers l''avant.
Redescends lentement.', 'Exercise_Ball_Crunch', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('afb2d885-f683-52aa-beb7-b255c0caaed0', null, 'Windmill (kettlebell)', 'windmill (kettlebell)', 'kettlebell', 'abs', array['glutes', 'hamstrings', 'shoulders', 'triceps']::text[], 'weight_reps', 'Debout, kettlebell tenue bras tendu au-dessus de la tête.
Incline le buste sur le côté en poussant les hanches.
Remonte en gardant le regard sur la charge.', 'Kettlebell_Windmill', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('205f0423-7f35-5653-a8c3-9d5dfbd53674', null, 'Squat (barre)', 'squat (barre)', 'barbell', 'quads', array['calves', 'glutes', 'hamstrings', 'lower_back']::text[], 'weight_reps', 'Place la barre sur les trapèzes, pieds à la largeur des épaules.
Descends en poussant les hanches en arrière, dos droit.
Remonte en poussant dans les talons jusqu''à l''extension.', 'Barbell_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9c135d88-1955-5eb9-9485-86046c3c5707', null, 'Squat avant (barre)', 'squat avant (barre)', 'barbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Place la barre sur l''avant des épaules, coudes hauts.
Descends en gardant le buste vertical.
Remonte en poussant dans le sol.', 'Front_Barbell_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('36dcd75e-c186-592c-a3d6-ec62fc15a4c2', null, 'Squat overhead (barre)', 'squat overhead (barre)', 'barbell', 'quads', array['abs', 'calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Barre tenue bras tendus au-dessus de la tête, prise large.
Descends en gardant la barre au-dessus des talons.
Remonte en gardant les bras verrouillés.', 'Overhead_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('a7657f7b-a43b-50b0-af81-9a5bc832a873', null, 'Squat Zercher (barre)', 'squat zercher (barre)', 'barbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Place la barre dans le creux des coudes, contre le ventre.
Descends en gardant le buste droit.
Remonte en poussant dans le sol.', 'Zercher_Squats', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('b839809a-7e73-542f-b882-e5f34aa091d5', null, 'Squat (Smith)', 'squat (smith)', 'machine', 'quads', array['calves', 'glutes', 'hamstrings', 'lower_back']::text[], 'weight_reps', 'Place la barre guidée sur les trapèzes, pieds légèrement devant.
Descends en contrôlant jusqu''à la profondeur voulue.
Remonte puis raccroche en fin de série.', 'Smith_Machine_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('65d2d2fd-36e5-5c94-b06d-a7111d04a314', null, 'Hack squat (machine)', 'hack squat (machine)', 'machine', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Dos et épaules calés, pieds sur la plateforme.
Descends en fléchissant les genoux.
Remonte en poussant dans les talons.', 'Hack_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d9b8eaa6-5b1c-5e43-aea2-19f460d3defa', null, 'Presse à cuisses', 'presse a cuisses', 'machine', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Assis, dos calé, pieds sur la plateforme à largeur d''épaules.
Descends la plateforme jusqu''à environ 90° aux genoux.
Pousse sans verrouiller les genoux.', 'Leg_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('91b74e5a-e403-5d99-9d28-556153e54504', null, 'Leg extension (machine)', 'leg extension (machine)', 'machine', 'quads', '{}'::text[], 'weight_reps', 'Assis, dos calé, chevilles sous le rouleau.
Étends les jambes jusqu''à les tendre.
Redescends lentement.', 'Leg_Extensions', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('75731ae3-a34c-590c-8691-10788831ef6f', null, 'Squat goblet (kettlebell)', 'squat goblet (kettlebell)', 'kettlebell', 'quads', array['calves', 'glutes', 'hamstrings', 'shoulders']::text[], 'weight_reps', 'Tiens la kettlebell contre la poitrine, pieds un peu plus larges que les épaules.
Descends en gardant le buste droit.
Remonte en poussant dans le sol.', 'Goblet_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5783728d-dd08-5860-a79c-66f8a206284f', null, 'Squat (haltères)', 'squat (halteres)', 'dumbbell', 'quads', array['calves', 'glutes', 'hamstrings', 'lower_back']::text[], 'weight_reps', 'Tiens un haltère dans chaque main, bras le long du corps.
Descends en poussant les hanches en arrière.
Remonte en poussant dans le sol.', 'Dumbbell_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('712537d0-6ad9-59fb-acd0-b775f23fa5b1', null, 'Squat au poids du corps', 'squat au poids du corps', 'bodyweight', 'quads', array['glutes', 'hamstrings']::text[], 'bodyweight', 'Pieds à la largeur des épaules, bras devant toi.
Descends en poussant les hanches en arrière, dos droit.
Remonte jusqu''à l''extension.', 'Bodyweight_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d8ba8ab3-6046-51f3-85e0-7d5a1116fa1e', null, 'Fente (barre)', 'fente (barre)', 'barbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Barre sur les trapèzes, fais un grand pas en avant.
Descends jusqu''à ce que le genou arrière frôle le sol.
Pousse sur le pied avant pour revenir.', 'Barbell_Lunge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ea111b0a-e38f-5a59-a1c8-b89fff03875c', null, 'Fentes marchées (barre)', 'fentes marchees (barre)', 'barbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Barre sur les trapèzes, fais un grand pas en avant.
Descends jusqu''à ce que le genou arrière frôle le sol.
Pousse et enchaîne avec l''autre jambe.', 'Barbell_Walking_Lunge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('752989bf-7359-5700-bd4d-09a6f101699a', null, 'Fentes (haltères)', 'fentes (halteres)', 'dumbbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Un haltère dans chaque main, fais un grand pas en avant.
Descends jusqu''à ce que le genou arrière frôle le sol.
Pousse sur le pied avant pour revenir.', 'Dumbbell_Lunges', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('44e05b57-be97-551a-86b0-f7986ddf07e7', null, 'Fente arrière (haltères)', 'fente arriere (halteres)', 'dumbbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Un haltère dans chaque main, fais un pas en arrière.
Descends jusqu''à ce que le genou arrière frôle le sol.
Pousse sur le pied avant pour revenir.', 'Dumbbell_Rear_Lunge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('921b71dc-d9e2-5e7c-a74a-ab45b1d72fd4', null, 'Fentes marchées (poids du corps)', 'fentes marchees (poids du corps)', 'bodyweight', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'bodyweight', 'Fais un grand pas en avant et descends en gardant le buste droit.
Pousse sur le pied avant pour avancer.
Enchaîne en alternant les jambes.', 'Bodyweight_Walking_Lunge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4844ff66-b547-5dfa-9d5b-c658fd5643ab', null, 'Split squat (haltères)', 'split squat (halteres)', 'dumbbell', 'quads', array['glutes', 'hamstrings']::text[], 'weight_reps', 'Un pied en avant, un pied en arrière, un haltère dans chaque main.
Descends à la verticale jusqu''à frôler le sol avec le genou arrière.
Remonte en poussant sur le pied avant.', 'Split_Squat_with_Dumbbells', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('db006b1d-8249-507c-8e25-a53241ed8abd', null, 'Montées sur banc (haltères)', 'montees sur banc (halteres)', 'dumbbell', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Un haltère dans chaque main, un pied sur le banc.
Monte en poussant sur la jambe d''appui.
Redescends lentement.', 'Dumbbell_Step_Ups', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('08fb90bb-b56a-52ba-9833-5b050cf555ec', null, 'Squat sauté', 'squat saute', 'bodyweight', 'quads', array['calves', 'glutes', 'hamstrings']::text[], 'bodyweight', 'Descends en squat, bras en arrière.
Saute en extension complète.
Amortis la réception et enchaîne.', 'Freehand_Jump_Squat', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('57357c35-7485-564b-a1a9-22c36603e50c', null, 'Leg extension unilatéral (machine)', 'leg extension unilateral (machine)', 'machine', 'quads', '{}'::text[], 'weight_reps', 'Assis, dos calé, une cheville sous le rouleau.
Étends la jambe jusqu''à la tendre.
Redescends lentement.', 'Single-Leg_Leg_Extension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f64cab66-9789-5558-9e56-209adb81e28e', null, 'Soulevé de terre trap bar', 'souleve de terre trap bar', 'other', 'quads', array['glutes', 'hamstrings']::text[], 'weight_reps', 'Place-toi au centre de la barre, saisis les poignées, dos plat.
Pousse dans le sol pour te relever jusqu''à l''extension.
Redescends la barre en contrôlant.', 'Trap_Bar_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5b8e7af9-f85f-5c12-a0a6-c17302e7ffd7', null, 'Soulevé de terre roumain (barre)', 'souleve de terre roumain (barre)', 'barbell', 'hamstrings', array['calves', 'glutes', 'lower_back']::text[], 'weight_reps', 'Debout, barre devant les cuisses, genoux légèrement fléchis.
Recule les hanches et descends la barre le long des jambes.
Remonte en contractant les fessiers et les ischios.', 'Romanian_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('adbb9fb4-da50-5ea4-b187-1da9cd0b16e7', null, 'Soulevé de terre jambes tendues (barre)', 'souleve de terre jambes tendues (barre)', 'barbell', 'hamstrings', array['glutes', 'lower_back']::text[], 'weight_reps', 'Debout, barre devant les cuisses, jambes presque tendues.
Penche le buste en gardant le dos plat jusqu''à l''étirement des ischios.
Remonte en poussant les hanches vers l''avant.', 'Stiff-Legged_Barbell_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d899bfca-0451-5b8a-91d4-d9d4ce99a42c', null, 'Soulevé de terre jambes tendues (haltères)', 'souleve de terre jambes tendues (halteres)', 'dumbbell', 'hamstrings', array['glutes', 'lower_back']::text[], 'weight_reps', 'Debout, un haltère dans chaque main, jambes presque tendues.
Penche le buste en gardant le dos plat.
Remonte en poussant les hanches vers l''avant.', 'Stiff-Legged_Dumbbell_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2f9d9f40-e9cb-5f0c-b0e0-8a94dbcafe58', null, 'Leg curl couché (machine)', 'leg curl couche (machine)', 'machine', 'hamstrings', '{}'::text[], 'weight_reps', 'Allongé sur le ventre, chevilles sous le rouleau.
Fléchis les jambes pour amener les talons vers les fessiers.
Redescends lentement.', 'Lying_Leg_Curls', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('453d00e2-26ef-5f5f-8dc1-ba13a5bb8d7b', null, 'Leg curl assis (machine)', 'leg curl assis (machine)', 'machine', 'hamstrings', '{}'::text[], 'weight_reps', 'Assis, dos calé, rouleau derrière les chevilles.
Fléchis les jambes vers l''arrière.
Reviens lentement.', 'Seated_Leg_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('be55649d-a9b2-58b9-82f5-558bd2bac97e', null, 'Leg curl debout (machine)', 'leg curl debout (machine)', 'machine', 'hamstrings', '{}'::text[], 'weight_reps', 'Debout, une cheville sous le rouleau.
Fléchis la jambe pour amener le talon vers le fessier.
Redescends lentement.', 'Standing_Leg_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('2144da95-1c47-52a3-bdac-d2ce94f678dc', null, 'Good morning (barre)', 'good morning (barre)', 'barbell', 'hamstrings', array['abs', 'glutes', 'lower_back']::text[], 'weight_reps', 'Barre sur les trapèzes, genoux légèrement fléchis.
Penche le buste en reculant les hanches, dos plat.
Remonte en poussant les hanches vers l''avant.', 'Good_Morning', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('eb1d2a43-93cf-59f4-be50-bbd215dea06e', null, 'Soulevé de terre sumo (barre)', 'souleve de terre sumo (barre)', 'barbell', 'hamstrings', array['quads', 'forearms', 'glutes', 'lower_back']::text[], 'weight_reps', 'Pieds très écartés, mains saisissant la barre entre les jambes.
Pousse dans le sol pour te relever, dos plat.
Redescends en contrôlant.', 'Sumo_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3850a8a1-8f36-5e70-9dc5-ac974654afd0', null, 'Glute-ham raise', 'glute-ham raise', 'machine', 'hamstrings', array['calves', 'glutes']::text[], 'weight_reps', 'Cale les pieds dans la machine, hanches au bord du support.
Descends le buste puis remonte en contractant les ischios.
Garde le dos aligné.', 'Glute_Ham_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f762ba3e-1338-502d-8e93-2bcdd5a138e8', null, 'Leg curl sur ballon', 'leg curl sur ballon', 'other', 'hamstrings', array['calves', 'glutes']::text[], 'bodyweight', 'Allongé sur le dos, talons sur le ballon, bassin décollé.
Ramène le ballon vers les fessiers.
Étends les jambes lentement.', 'Ball_Leg_Curl', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('bcb02a2f-c4c4-5359-8508-a095d3bac4a2', null, 'Soulevé de terre unijambiste (kettlebell)', 'souleve de terre unijambiste (kettlebell)', 'kettlebell', 'hamstrings', array['glutes', 'lower_back']::text[], 'weight_reps', 'Debout sur une jambe, kettlebell dans la main opposée.
Penche le buste en levant l''autre jambe en arrière.
Remonte en contractant le fessier.', 'Kettlebell_One-Legged_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('3de9c8bf-1254-5a5b-9c4e-73841924b220', null, 'Swing kettlebell (une main)', 'swing kettlebell (une main)', 'kettlebell', 'hamstrings', array['calves', 'glutes', 'lower_back', 'shoulders']::text[], 'weight_reps', 'Pieds écartés, kettlebell devant toi.
Balance-la entre les jambes puis propulse-la par l''extension des hanches.
Laisse-la revenir et enchaîne.', 'One-Arm_Kettlebell_Swings', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('810122c1-5d07-5a23-bf47-cedd0a0402ca', null, 'Reverse hyper (machine)', 'reverse hyper (machine)', 'machine', 'hamstrings', array['calves', 'glutes']::text[], 'weight_reps', 'Allongé sur le ventre sur la machine, jambes pendantes.
Monte les jambes jusqu''à l''alignement avec le corps.
Redescends lentement.', 'Reverse_Hyperextension', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('0e7b4ecc-5fa2-5c08-99c7-4ee5ea3e4ebc', null, 'Hip thrust (barre)', 'hip thrust (barre)', 'barbell', 'glutes', array['calves', 'hamstrings']::text[], 'weight_reps', 'Dos contre un banc, barre sur les hanches.
Pousse sur les talons pour monter le bassin.
Contracte les fessiers en haut puis redescends.', 'Barbell_Hip_Thrust', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('80bab17c-3f62-5e98-a29c-baa2c231c7f2', null, 'Pont fessier (barre)', 'pont fessier (barre)', 'barbell', 'glutes', array['calves', 'hamstrings']::text[], 'weight_reps', 'Allongé sur le dos, barre sur les hanches, genoux fléchis.
Monte le bassin en poussant sur les talons.
Redescends lentement.', 'Barbell_Glute_Bridge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fb218166-7c12-5380-bbe5-951436205815', null, 'Pont fessier (poids du corps)', 'pont fessier (poids du corps)', 'bodyweight', 'glutes', array['hamstrings']::text[], 'bodyweight', 'Allongé sur le dos, genoux fléchis, pieds au sol.
Monte le bassin en contractant les fessiers.
Redescends lentement.', 'Butt_Lift_Bridge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('8cac713f-0a90-5cb2-9897-eadb54452ede', null, 'Pont fessier unijambiste', 'pont fessier unijambiste', 'bodyweight', 'glutes', array['hamstrings']::text[], 'bodyweight', 'Allongé sur le dos, une jambe tendue en l''air.
Monte le bassin en poussant sur le talon d''appui.
Redescends lentement.', 'Single_Leg_Glute_Bridge', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('a645237d-d5d6-5e47-bce4-b4dde79659cf', null, 'Kickback fessier (poulie)', 'kickback fessier (poulie)', 'cable', 'glutes', array['hamstrings']::text[], 'weight_reps', 'Cheville attachée à la poulie basse, appuie-toi sur la machine.
Pousse la jambe vers l''arrière en contractant le fessier.
Reviens lentement.', 'One-Legged_Cable_Kickback', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('84529e78-832d-5fd7-98b5-cdc739f51af4', null, 'Kickback fessier au sol', 'kickback fessier au sol', 'bodyweight', 'glutes', array['hamstrings']::text[], 'bodyweight', 'À quatre pattes, genou fléchi.
Pousse le talon vers le plafond.
Reviens sans cambrer.', 'Glute_Kickback', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('e01eed59-0c44-5fb8-af26-f6e439473157', null, 'Pull-through (poulie)', 'pull-through (poulie)', 'cable', 'glutes', array['hamstrings', 'lower_back']::text[], 'weight_reps', 'Dos à la poulie basse, corde entre les jambes.
Recule les hanches, puis projette-les en avant.
Contracte les fessiers en haut.', 'Pull_Through', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('dd60159c-9ffa-54c0-9406-d98bcd92b64c', null, 'Abduction de hanche (machine)', 'abduction de hanche (machine)', 'machine', 'glutes', '{}'::text[], 'weight_reps', 'Assis, genoux contre les coussins.
Écarte les jambes le plus loin possible.
Reviens lentement.', 'Thigh_Abductor', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('da2faaf2-fea2-51f5-a0a3-b4f9f9df9496', null, 'Adduction de hanche (machine)', 'adduction de hanche (machine)', 'machine', 'quads', array['glutes', 'hamstrings']::text[], 'weight_reps', 'Assis, jambes écartées contre les coussins.
Rapproche les jambes en serrant les cuisses.
Reviens lentement.', 'Thigh_Adductor', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9c86d800-c318-5270-aa50-1186044770d4', null, 'Marche latérale (élastique)', 'marche laterale (elastique)', 'band', 'glutes', '{}'::text[], 'bodyweight', 'Place l''élastique au-dessus des genoux, genoux fléchis.
Fais des pas latéraux en gardant la tension.
Garde le buste droit.', 'Monster_Walk', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('12eae5cf-8b70-59c0-9e4c-87240d7aefac', null, 'Mollets debout (machine)', 'mollets debout (machine)', 'machine', 'calves', '{}'::text[], 'weight_reps', 'Épaules sous les coussins, pointes de pieds sur la cale.
Monte sur la pointe des pieds au maximum.
Redescends lentement jusqu''à l''étirement.', 'Standing_Calf_Raises', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d9495358-0db0-540b-8278-9d8ab4684542', null, 'Mollets assis (machine)', 'mollets assis (machine)', 'machine', 'calves', '{}'::text[], 'weight_reps', 'Assis, genoux sous les coussins, pointes de pieds sur la cale.
Monte sur la pointe des pieds.
Redescends lentement.', 'Seated_Calf_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4e8d9758-0305-55f3-9202-b3f8bb274fba', null, 'Mollets à la presse', 'mollets a la presse', 'machine', 'calves', '{}'::text[], 'weight_reps', 'Assis à la presse, pointes de pieds en bas de la plateforme.
Pousse sur la pointe des pieds sans verrouiller les genoux.
Reviens lentement.', 'Calf_Press_On_The_Leg_Press_Machine', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('04e7e007-bf9f-5454-bde4-3f7c24e97126', null, 'Mollets debout (barre)', 'mollets debout (barre)', 'barbell', 'calves', '{}'::text[], 'weight_reps', 'Barre sur les trapèzes, pointes de pieds sur une cale.
Monte sur la pointe des pieds.
Redescends lentement.', 'Standing_Barbell_Calf_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5bd95204-b4f8-564c-a4db-fc7338f8735d', null, 'Mollets debout (haltères)', 'mollets debout (halteres)', 'dumbbell', 'calves', '{}'::text[], 'weight_reps', 'Un haltère dans chaque main, pointes de pieds sur une cale.
Monte sur la pointe des pieds.
Redescends lentement.', 'Standing_Dumbbell_Calf_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('6ef09831-430b-5ef2-925d-3794c1d9202e', null, 'Mollets debout (Smith)', 'mollets debout (smith)', 'machine', 'calves', '{}'::text[], 'weight_reps', 'Barre guidée sur les trapèzes, pointes de pieds sur une cale.
Monte sur la pointe des pieds.
Redescends lentement.', 'Smith_Machine_Calf_Raise', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('45a5816d-93cb-5d0b-9c7c-6d0bfee36c95', null, 'Mollets donkey', 'mollets donkey', 'other', 'calves', '{}'::text[], 'weight_reps', 'Penché en avant, mains en appui, charge sur le bassin.
Monte sur la pointe des pieds.
Redescends lentement.', 'Donkey_Calf_Raises', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d182b342-c696-5d46-b548-d9703877c80b', null, 'Soulevé de terre (barre)', 'souleve de terre (barre)', 'barbell', 'lower_back', array['calves', 'forearms', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Pieds sous la barre, dos plat, mains à largeur d''épaules.
Pousse dans le sol pour te redresser en gardant la barre contre toi.
Redescends en contrôlant.', 'Barbell_Deadlift', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('6b42de4e-ae82-57e8-8614-e24336fbb9d0', null, 'Rack pull (barre)', 'rack pull (barre)', 'barbell', 'lower_back', array['forearms', 'glutes', 'hamstrings', 'traps']::text[], 'weight_reps', 'Barre posée sur les supports à hauteur des genoux.
Redresse-toi en poussant les hanches vers l''avant.
Redescends en contrôlant.', 'Rack_Pulls', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4d3bb321-5241-5281-8a94-66fc4b24ea4e', null, 'Extension lombaire (banc à 45°)', 'extension lombaire (banc a 45°)', 'other', 'lower_back', array['glutes', 'hamstrings']::text[], 'weighted_bw', 'Cale les pieds, hanches au bord du support.
Descends le buste puis remonte jusqu''à l''alignement.
Évite de cambrer en haut.', 'Hyperextensions_Back_Extensions', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('9a49933d-3e4b-5792-87b0-82aea7e4ee4c', null, 'Extension lombaire au sol', 'extension lombaire au sol', 'bodyweight', 'lower_back', array['glutes', 'hamstrings']::text[], 'bodyweight', 'Allongé sur le ventre, bras le long du corps.
Soulève le buste et les jambes du sol.
Redescends lentement.', 'Hyperextensions_With_No_Hyperextension_Bench', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f4405709-63d1-5f1e-98e2-b598725e6246', null, 'Épaulé (barre)', 'epaule (barre)', 'barbell', 'hamstrings', array['calves', 'forearms', 'glutes', 'lower_back']::text[], 'weight_reps', 'Barre au sol, dos plat, mains à largeur d''épaules.
Tire en extension puis attrape la barre sur les épaules.
Redescends la barre en contrôlant.', 'Power_Clean', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('d2354977-aad1-594c-a9a8-233013fe36f4', null, 'Épaulé suspendu (barre)', 'epaule suspendu (barre)', 'barbell', 'quads', array['calves', 'forearms', 'glutes', 'hamstrings']::text[], 'weight_reps', 'Barre à hauteur des cuisses, dos plat.
Étends les hanches en tirant la barre vers le haut.
Attrape-la sur les épaules.', 'Hang_Clean', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('820680f9-cbf3-5325-bd2f-4702fecdfd1a', null, 'Turkish get-up (kettlebell)', 'turkish get-up (kettlebell)', 'kettlebell', 'shoulders', array['abs', 'calves', 'hamstrings', 'quads']::text[], 'weight_reps', 'Allongé, kettlebell bras tendu, genou plié.
Relève-toi en passant par le coude et la main.
Redescends en inversant les étapes.', 'Kettlebell_Turkish_Get-Up_Squat_style', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('99ee76a2-8fc7-5c50-9436-0395475b5d6a', null, 'Thruster (kettlebell)', 'thruster (kettlebell)', 'kettlebell', 'shoulders', array['quads', 'triceps']::text[], 'weight_reps', 'Kettlebell à hauteur d''épaule, descends en squat.
Remonte et pousse la charge au-dessus de la tête.
Redescends la kettlebell et recommence.', 'Kettlebell_Thruster', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('10642bd4-fa4e-5a88-85a2-24b658b8b6b2', null, 'Rowing deux kettlebells', 'rowing deux kettlebells', 'kettlebell', 'back', array['biceps']::text[], 'weight_reps', 'Penché en avant, dos plat, une kettlebell dans chaque main.
Tire vers les hanches en serrant les omoplates.
Redescends lentement.', 'Two-Arm_Kettlebell_Row', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('a9b94e39-dc16-54d8-a518-3957ef8e99e9', null, 'Développé militaire (kettlebells)', 'developpe militaire (kettlebells)', 'kettlebell', 'shoulders', array['triceps']::text[], 'weight_reps', 'Une kettlebell dans chaque main à hauteur d''épaule.
Pousse-les au-dessus de la tête.
Redescends lentement.', 'Two-Arm_Kettlebell_Military_Press', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('1b3f4a50-2ec1-5996-8a75-af320eb452ae', null, 'Rameur', 'rameur', 'machine', 'cardio', array['biceps', 'calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Cale les pieds, saisis la poignée, bras tendus.
Pousse sur les jambes, puis tire la poignée vers le ventre.
Reviens en étendant les bras puis en pliant les genoux.', 'Rowing_Stationary', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('5cf89029-89fe-5efd-ae6e-2034e37255d2', null, 'Vélo d''appartement', 'velo d''appartement', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Règle la selle à hauteur de hanche.
Pédale à rythme régulier.
Adapte la résistance à l''effort voulu.', 'Bicycling_Stationary', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('08cae543-9f86-5d59-824f-db9e36b9f0c9', null, 'Vélo semi-allongé', 'velo semi-allonge', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Règle la distance du siège.
Pédale à rythme régulier.
Adapte la résistance à l''effort voulu.', 'Recumbent_Bike', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('7970303d-c636-56e2-86f9-052efba50d0d', null, 'Course sur tapis', 'course sur tapis', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Démarre doucement, pieds centrés sur le tapis.
Cours à l''allure voulue en gardant le buste droit.
Ralentis avant de t''arrêter.', 'Running_Treadmill', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('14b3575d-3a3f-5c9a-88a7-a663c4417f94', null, 'Footing sur tapis', 'footing sur tapis', 'machine', 'cardio', array['glutes', 'hamstrings']::text[], 'distance_duration', 'Démarre doucement.
Garde une allure modérée et régulière.
Ralentis progressivement avant de t''arrêter.', 'Jogging_Treadmill', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('8fd70193-4a2d-5feb-ad4b-a15c60cc2d98', null, 'Marche sur tapis', 'marche sur tapis', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Démarre à vitesse lente.
Marche d''un pas régulier, dos droit.
Ajoute de l''inclinaison pour intensifier.', 'Walking_Treadmill', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('fe1282ba-db37-51ac-b841-6790119930d9', null, 'Vélo elliptique', 'velo elliptique', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Monte sur les pédales, saisis les poignées.
Mouvement fluide de pédalage, dos droit.
Adapte la résistance à l''effort voulu.', 'Elliptical_Trainer', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('4aed6360-512c-5a76-9d65-a394c06a03c9', null, 'Escalier (Stairmaster)', 'escalier (stairmaster)', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'duration', 'Monte sur la machine, saisis les rampes.
Monte les marches à rythme régulier, buste droit.
Évite de t''appuyer fortement sur les rampes.', 'Stairmaster', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('50cc0b60-b9fa-54db-be79-a9dd809d1b65', null, 'Corde à sauter', 'corde a sauter', 'other', 'cardio', array['calves', 'hamstrings']::text[], 'duration', 'Tiens la corde, coudes près du corps.
Saute avec de petits rebonds sur l''avant-pied.
Garde un rythme régulier.', 'Rope_Jumping', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('f8609f03-a332-5ee5-97d2-61d32beb2896', null, 'Escalier roulant (Step Mill)', 'escalier roulant (step mill)', 'machine', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'duration', 'Monte sur la machine.
Monte les marches à rythme régulier.
Ralentis avant de descendre.', 'Step_Mill', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('69df0202-c807-51e8-87ff-229ac6ddc3b5', null, 'Course ou marche en extérieur', 'course ou marche en exterieur', 'other', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Choisis un itinéraire adapté.
Garde une allure régulière.
Hydrate-toi si l''effort est long.', 'Trail_Running_Walking', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('dbd76323-85b1-56ef-ae71-5eb91606bee0', null, 'Vélo en extérieur', 'velo en exterieur', 'other', 'cardio', array['calves', 'glutes', 'hamstrings']::text[], 'distance_duration', 'Règle la selle à la bonne hauteur.
Pédale à rythme régulier.
Adapte la vitesse à l''effort voulu.', 'Bicycling', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000'),
  ('ed7cc5c5-6a8a-5fc9-9a9c-7d7b6da8d38c', null, 'Cordes ondulatoires', 'cordes ondulatoires', 'other', 'shoulders', array['chest', 'forearms']::text[], 'duration', 'Tiens une corde dans chaque main, genoux fléchis.
Fais des ondulations rapides avec les bras.
Garde le buste gainé.', 'Battling_Ropes', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000')
on conflict (id) do update set
  name = excluded.name,
  name_search = excluded.name_search,
  equipment = excluded.equipment,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  measurement_type = excluded.measurement_type,
  instructions = excluded.instructions,
  source_id = excluded.source_id,
  client_updated_at = excluded.client_updated_at,
  client_device_id = excluded.client_device_id;
