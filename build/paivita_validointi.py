# Laskee approksimaation osuvuuden uudelleen tuoreesta FST-otoksesta ja
# päivittää sen pelattavuus.json:iin. Erillinen skripti, koska pelattavuusajo
# kestää minuutteja eikä sitä kannata toistaa pelkän validoinnin vuoksi.
import json
from pathlib import Path

import mittaa_pelattavuus as p

OUT = Path(__file__).resolve().parent / "mittaus"
d = json.loads((OUT / "pelattavuus.json").read_text(encoding="utf-8"))
d["approksimaation_validointi"] = p.validoi_approksimaatio()
(OUT / "pelattavuus.json").write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(d["approksimaation_validointi"], ensure_ascii=False, indent=2))
