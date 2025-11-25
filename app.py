from flask import Flask, render_template, redirect, url_for, request
from node import *
from mantiq_map import *

app = Flask(__name__)

# Create an argument
mymap = MantiqMap()
root_node = Node("Therefore, not A", "Therefore, it is false that (1AB) prime-matter without physical form that can be pointed at and is divisible is a plane.")
mymap.set_root(root_node)
mymap.set_title("the Impossibility of Prime-matter without physical form being a plane")

mymap.add_subpremise(0, "If A then either B or C", "If (1AB) prime-matter without physical form that can be pointed at and is divisible is a plane, then either (1ABA) it is something that, when it is found on the edge of two surfaces of a physical object, prevents them from touching, or (1ABB) it is something that, when it is found on the edge of two surfaces of a physical object, does not prevent them from touching.", PremiseType.SELF_EVIDENT)
mymap.add_subpremise(0, "Not B", "It is false that (1ABA) it is something that, when it is found on the edge of two surfaces of a physical object, prevents them from touching.", PremiseType.INFERENTIAL)
mymap.add_subpremise(0, "Not C", "And it is false that (1ABB) it is something that, when it is found on the edge of two surfaces of a physical object, does not prevent them from touching.", PremiseType.INFERENTIAL)

mymap.add_subpremise(2, "If A then B", "If (1ABA) it prevents them from touching, then the plane would be divisible in three dimensions; because part of the plane that touches the first surface is different than the part of the plane which touches the second surface.", PremiseType.SELF_EVIDENT)
mymap.add_subpremise(2, "Not B", "It is false that the plane is divisible in three dimensions.", PremiseType.SELF_EVIDENT)

mymap.add_subpremise(3, "If A then B", "If (1ABB) it is something that, when it is found on the edge of two surfaces of a physical object, does not prevent them from touching, then multiple planes would penetrate each other.", PremiseType.SELF_EVIDENT)
mymap.add_subpremise(3, "Not B", "It is false that multiple planes would penetrate each other.", PremiseType.INFERENTIAL)

mymap.add_subpremise(7, "If A then not B", "If multiple planes would penetrate each other, then the interpenetration would entail that it is false that the addition of every two planes must be larger than each individual plane.", PremiseType.SELF_EVIDENT)
mymap.add_subpremise(7, "B", "It is true that the addition of every two planes must be larger than each individual plane.", PremiseType.SELF_EVIDENT)

@app.route("/add_premise", methods=["POST"])
def add_premise():
    arg_num = request.form.get("arg_num")[1:] or 0
    mymap.add_subpremise(arg_num, '', '', PremiseType.SELF_EVIDENT)
    return redirect(url_for("home"))

@app.route("/delete_premise", methods=["POST"])
def delete_premise():
    premise_num = request.form.get("premise_num")
    if premise_num:
        mymap.delete_premise(premise_num)
    
    return redirect(url_for("home"))

@app.route("/")
def home():    
    return render_template("index.html", argument_chart=mymap.get_chart_representation(), premise_types=mymap.get_premise_types_list())

if __name__ == "__main__":
    app.run(debug=True)