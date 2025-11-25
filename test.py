from node import *
from mantiq_map import *

my_argument = MantiqMap()
my_argument.set_root(Node("Not A"))
my_argument.add_subpremise(barebones_form="If A then B", premise_type=PremiseType.SELF_EVIDENT)
my_argument.add_subpremise(barebones_form="Not B", premise_type=PremiseType.INFERENTIAL)

my_argument.root.children[1].add_child("If C then not B", premise_type=PremiseType.SELF_EVIDENT)
my_argument.root.children[1].add_child("C", premise_type=PremiseType.SELF_EVIDENT)

my_argument.display()