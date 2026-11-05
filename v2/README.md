# Charges copropriété — v2

Suivi des charges et paiements d'un copropriétaire, **piloté par formules** : aucune édition ne déclenche de
script (la v1 coûtait ~1,2 s de latence Apps Script par modification). Le script sert uniquement à installer les
onglets et aux actions ponctuelles du menu **Charges TBA**.

## Onglets

| Onglet            | Rôle                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Paiements         | Un paiement par ligne (chèque, virement…). Montant négatif = remboursement du syndic.           |
| Charges           | Les charges à payer, avec payé, reste, solde, avancement, objectif à ce jour, retard et statut. |
| Affectations      | Répartition d'un paiement sur des charges, via listes déroulantes (charges restantes d'abord).  |
| Échéances         | Objectifs de versement par charge (mensuel, trimestriel, calendrier libre).                     |
| Vue par charge    | Charges triées par retard + synthèse par catégorie.                                             |
| Vue chronologique | Solde cumulé par date + graphique.                                                              |
| Tableau de bord   | KPI, objectif vs réalisé sur une période (trimestre courant par défaut), légende.               |
| Paramètres        | Types, catégories et listes dynamiques (ne pas modifier les colonnes C à E).                    |

En-têtes **bleus** = à saisir, **gris** = calculés (protégés par avertissement). Les statuts commencent par un
symbole (✔ ⏳ ◐ ⚠ ✖ ↩) en plus de la couleur.

## Mise en route

1. Créer un Google Sheet vide, puis dans `v2/` : `pnpm login`.
2. Créer le script lié : `pnpm exec clasp create --type sheets --title "Charges TBA v2" --rootDir dist`
   (ou copier `.clasp.json.example` en `.clasp.json` avec le `scriptId` d'un script lié au classeur).
3. `pnpm push`, recharger le classeur, menu **Charges TBA → Installer / réparer les onglets** (autoriser les droits).
4. Optionnel : **Ajouter des données de démonstration**, puis **Contrôle de cohérence**.

`v2/.clasp.json` est ignoré par git. L'installation est idempotente (elle ne touche pas aux données saisies).

## Fonctionnement

- Clés lisibles au lieu d'identifiants : paiement `aaaa-mm-jj · Type · montant[ · Réf]`, charge `aaaa-mm-jj · Libellé`.
  Contrairement à des identifiants par ligne, elles restent valides après un tri ou une insertion de ligne ; en
  revanche **modifier la date ou le libellé d'une charge après affectation casse le lien** (✖ dans la colonne
  Contrôle). Deux paiements identiques doivent avoir une `Réf` différente (⚠ Doublon sinon).
- Sans échéancier, une charge est due en totalité à sa date. Objectif à ce jour = cumul des échéances échues ;
  Retard = max(0, objectif − payé).
- Les listes déroulantes sont en mode avertissement : les éléments soldés restent sélectionnables, en fin de liste.
- Menu : échéancier uniforme (n fois, tous les k mois), calendrier personnalisé, suppression, import de la v1
  (plage nommée `TableCharges`), données de démo, contrôle de cohérence.
- Limite : 1000 lignes par onglet ; `*` et `?` dans un libellé peuvent fausser les `SUMIFS`.

## Limites connues / à valider

Les formules (`MAP`, `LET`, `SCAN`, `HSTACK`) n'ont pas pu être exécutées contre Google Sheets pendant le
développement. Checklist de validation manuelle :

1. Installer, ajouter les données de démo : aucune cellule ne doit afficher `#ERROR!` / `#REF!`.
2. **Contrôle de cohérence** : doit annoncer « Aucune différence ».
3. Ajouter une affectation : les colonnes Payé / Reste / Statut se mettent à jour instantanément.
4. Vérifier les listes déroulantes d'Affectations et d'Échéances, puis l'échéancier uniforme.
5. Si une formule diffère selon la locale (séparateurs), la corriger dans `src/Schema.ts` et réinstaller.

## Développement

```bash
pnpm test        # build + tests node (formules équilibrées, échéanciers, migration, modèle de référence)
pnpm typecheck
```
