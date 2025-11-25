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

        self.barebones_form = barebones_form
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
        print(f"{indent}- [{num}]: {self.barebones_form} | '{self.written_premise}' {'' if self.is_root else ptype}")


        for node in self.premises:
            node.recursive_display(level + 1)