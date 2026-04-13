from enum import Enum, auto

class PremiseType(Enum):
    INFERENTIAL = auto()

    SELF_EVIDENT = auto()
    OBSERVATIONAL = auto()
    EMPERICALLY_OBSERVED = auto()
    INTROSPECTIVELY_OBSERVED = auto()
    TESTED = auto()
    INTUITED = auto()
    MASS_TESTIFIED = auto()
    SUBCONSCIOUSLY_INFERRED = auto()

class Node:
    def __init__(
            self, 
            barebones_form="", 
            written_premise="", 
            premise_type: PremiseType | None = None
        ):
        self.is_root = False

        # barebones is a dict with two keys:
        # "parent" — how this premise appears in the parent table
        # "child"  — how this premise appears as the conclusion of its own sub-argument table
        self.barebones = {
            "parent": barebones_form,
            "child": ""
        }

        self.written_premise = written_premise
        self.premise_type = premise_type
        self.premises = []
        self.number: int = None

    def add_premise(
            self, 
            barebones_form="", 
            written_premise="", 
            premise_type : PremiseType | None = None
        ):
        self.premises.append(Node(barebones_form, written_premise, premise_type))
        
    def recursive_display(self, level=0):
        indent = "    " * level
        num = "C" if self.is_root else self.number 
        ptype = f"({self.premise_type.name})" if self.premise_type else ""
        print(f"{indent}- [{num}]: {self.barebones['parent']} | '{self.written_premise}' {'' if self.is_root else ptype}")
        for node in self.premises:
            node.recursive_display(level + 1)

    # ── Serialization ──────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "is_root": self.is_root,
            "barebones": self.barebones,
            "written_premise": self.written_premise,
            "premise_type": self.premise_type.name if self.premise_type else None,
            "number": self.number,
            "premises": [p.to_dict() for p in self.premises]
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Node":
        premise_type = PremiseType[d["premise_type"]] if d.get("premise_type") else None
        node = cls(premise_type=premise_type)
        node.is_root = d.get("is_root", False)
        node.barebones = d.get("barebones", {"parent": "", "child": ""})
        node.written_premise = d.get("written_premise", "")
        node.number = d.get("number", None)
        node.premises = [cls.from_dict(p) for p in d.get("premises", [])]
        return node