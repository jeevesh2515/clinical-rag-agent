import ast
import operator
import re


ALLOWED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
}


def calculate_expression(expression: str) -> float:
    tree = ast.parse(expression, mode="eval")
    return float(_eval(tree.body))


def calculate_bmi(question: str) -> str | None:
    kg = re.search(r"(\d+(?:\.\d+)?)\s*kg", question, flags=re.I)
    metres = re.search(r"(\d+(?:\.\d+)?)\s*m(?:etre|eter)?s?\b", question, flags=re.I)
    if kg and metres:
        weight = float(kg.group(1))
        height = float(metres.group(1))
        bmi = weight / (height * height)
        return f"BMI = {bmi:.1f} kg/m^2"
    return None


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
        return float(node.value)
    if isinstance(node, ast.BinOp) and type(node.op) in ALLOWED_OPERATORS:
        return ALLOWED_OPERATORS[type(node.op)](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in ALLOWED_OPERATORS:
        return ALLOWED_OPERATORS[type(node.op)](_eval(node.operand))
    raise ValueError("Unsupported calculation")
