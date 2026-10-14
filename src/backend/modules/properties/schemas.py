from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class BuildingCreate(BaseModel):
    management_company_id: int
    city: str = Field(min_length=1, max_length=120)
    street: str = Field(min_length=1, max_length=200)
    house_number: str = Field(min_length=1, max_length=30)
    building_suffix: str | None = Field(default=None, max_length=30)


class EntranceCreate(BaseModel):
    building_id: int
    number: str = Field(min_length=1, max_length=30)


class ApartmentCreate(BaseModel):
    building_id: int
    entrance_id: int | None = None
    number: str = Field(min_length=1, max_length=30)


class CompanyRead(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class BuildingRead(BaseModel):
    id: int
    management_company_id: int
    city: str
    street: str
    house_number: str
    building_suffix: str
    model_config = ConfigDict(from_attributes=True)


class EntranceRead(BaseModel):
    id: int
    building_id: int
    number: str
    model_config = ConfigDict(from_attributes=True)


class ApartmentRead(BaseModel):
    id: int
    building_id: int
    entrance_id: int | None
    number: str
    model_config = ConfigDict(from_attributes=True)
