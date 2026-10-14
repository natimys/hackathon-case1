from core.modules import ModuleDefinition

module = ModuleDefinition(
    active=True, name="cameras", router_prefix="/cameras", router_tags=["cameras"]
)
