from node import *

class MantiqMap:
    
    #Constructor
    def __init__(self, root=None):
        self.root = root
        self.title = ""

    # Public methods
    def set_root(self, root):
        self.root = root
        root.is_root = True

    def set_title(self, title):
        self.title = title

    def add_subpremise(self,
                    number: int = 0, 
                    barebones_form = "", 
                    written_premise = "", 
                    premise_type: PremiseType | None = None
                    ):
        if number == 0:
            self.root.add_premise(barebones_form, written_premise, premise_type)
        else:
            target_premise = self.find_node_by_number(self.root, f"P{number}")
        
            if target_premise and target_premise.premise_type==PremiseType.INFERENTIAL:
                target_premise.add_premise(barebones_form, written_premise, premise_type)
            else:
                raise ValueError(f"f{number} not found.")
        
        self.assign_numbers()
  
    def delete_premise(self, premise_number: int):
        """Recursively searches and deletes the premise with the given number."""
        
        def recurse_delete(node, number):
            for i, premise in enumerate(node.premises):
                if premise.number == number:
                    del node.premises[i]
                    self.assign_numbers()
                    return True
                if recurse_delete(premise, number):
                    return True
            return False
        
        recurse_delete(self.root, premise_number)
    
    def display(self):
        self.root.recursive_display()
    
    def get_chart_representation(self) -> list:
        """
        Returns a list of tables (charts), each containing rows.
        Table 1: High-level argument (root node + its direct premises)
        Sub-tables: For each inferential premise, a table showing:
                    - its supporting premises
                    - the premise being proven (reiterated)
        """
        charts = []

        # =============== 1. HIGH-LEVEL ARGUMENT TABLE ===============
        high_level_argument_rows = []

        # Include all direct premises before the conclusion
        for premise in self.root.premises:
            high_level_argument_rows.append({
                "number": premise.number,
                "barebones": premise.barebones_form,
                "written_premise": premise.written_premise,
                "premise_type": self.format_premise_type(premise.premise_type)
            })
            
        # Include the root conclusion
        high_level_argument_rows.append({
            "barebones": self.root.barebones_form,
            "written_premise": self.root.written_premise
        })

        title = "High-Level Argument" + (" For " + self.title.title() if self.title else "")
        charts.append({
            "title": title,
            "rows": high_level_argument_rows,
            "level": 1
        })

        # =============== 2. SUB-ARGUMENT TABLES ===============
        def add_subtables(node, depth):
            for premise in node.premises:
                if premise.premises:  # Only create sub-table if it has children
                    subt_rows = []

                    # Add all supporting premises
                    for child in premise.premises:
                        subt_rows.append({
                            "number": child.number,
                            "barebones": child.barebones_form,
                            "written_premise": child.written_premise,
                            "premise_type": self.format_premise_type(child.premise_type)
                        })

                    # Reiterate the premise being proven
                    subt_rows.append({
                        "number": premise.number,
                        "barebones": premise.barebones_form,
                        "written_premise": "Therefore: " + premise.written_premise
                    })

                    charts.append({
                        "title": f"Sub-Argument for {premise.number}",
                        "rows": subt_rows,
                        "level": depth
                    })

                    add_subtables(premise, depth + 1)

        add_subtables(self.root, 2)
        return charts
    
    def get_premise_types_list(self):
        return [self.format_premise_type(pt) for pt in PremiseType]
    
    # Helper methods
    def assign_numbers(self):
        counter = 1

        # Assign numbers to root's children first (main premises)
        for premise in self.root.premises:
            premise.number = f"P{counter}"
            counter += 1

        # Then assign numbers to sub-arguments recursively
        def assign_sub(node):
            nonlocal counter
            
            for premise in node.premises:
                premise.number = f"P{counter}"
                counter += 1
                assign_sub(premise)

        for premise in self.root.premises:
            assign_sub(premise)
            
    def find_node_by_number(self, node: Node, number: str) -> Node | None:
        if getattr(node, "number", None) == number:
            return node
        
        for premise in node.premises:
            
            found = self.find_node_by_number(premise, number)
            
            if found:
                return found
        
        return None
    
    def format_premise_type(self, premise_type: PremiseType) -> str:
        # premise_types = {
        #     PremiseType.INFERENTIAL: "Inferential [naẓariyyāt]",
        #     PremiseType.SELF_EVIDENT: "Self-Evident [awwaliyyāt]",
        #     PremiseType.OBSERVATIONAL: "Observational [mushāhadāt]",
        #     PremiseType.EMPERICALLY_OBSERVED: "Empirically Observed [ḥissiyyāt]",
        #     PremiseType.INTROSPECTIVELY_OBSERVED: "Introspectively Observed [wijdāniyyāt]",
        #     PremiseType.TESTED: "Tested [mujarrabāt]",
        #     PremiseType.INTUITED: "Intuited [ḥadsiyyāt]",
        #     PremiseType.MASS_TESTIFIED: "Mass-Transmitted [mutawātirāt]",
        #     PremiseType.SUBCONSCIOUSLY_INFERRED: "Subconsciously-Inferred [fiṭriyyāt]"
        # }
        return premise_type.name.replace('_', ' ').title()
        # return premise_types[premise_types]