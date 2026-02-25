# Auto Diagram from YAML

Petit viewer local pour afficher un diagramme de features a partir de `YAML/features.yaml`.

## Prerequis

- Python 3.8+ installe
- Un navigateur web

## Lancer le projet

Le viewer est servi en local sur `http://localhost:8080/viewer/`.

### Windows (PowerShell)

```powershell
cd d:\Scripting\Auto_Diagramme_from_YAML
.\start-diagram.ps1
```

Changer le port (ex: 8090) :

```powershell
.\start-diagram.ps1 -Port 8090
```

### macOS / Linux

```bash
cd /chemin/vers/Auto_Diagramme_from_YAML
python3 start-diagram.py
```

Changer le port (ex: 8090) :

```bash
python3 start-diagram.py --port 8090
```

## Creer un nouveau diagramme avec une IA

1. Donne a l'IA le fichier `YAML/AI_CONTRACT.md` (c'est la structure obligatoire).
2. Demande-lui d'extraire les features de ton projet et de produire un fichier YAML conforme.
3. Sauvegarde le resultat dans `YAML/features.yaml`.
4. Relance le serveur (ou recharge la page) pour voir le nouveau diagramme.

Prompt conseille :

```text
Lis le contrat dans YAML/AI_CONTRACT.md.
Analyse mon projet et extrait les features metier.
Genere un fichier YAML strictement conforme au contrat
avec les cles top-level `domains` et `relationships`.
Retourne uniquement le YAML final.
```

## Notes

- Fichier charge par defaut : `YAML/features.yaml`
- Tu peux aussi charger un autre fichier YAML manuellement depuis l'interface.
