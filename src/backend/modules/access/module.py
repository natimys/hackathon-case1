from core.modules import ModuleDefinition

module = ModuleDefinition(
    active=True,
    name="access",
    router_prefix="/access",
    router_tags=["access"],
)
