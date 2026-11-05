from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.plan_spec_additional_directions_type_0_item import PlanSpecAdditionalDirectionsType0Item
    from ..models.plan_spec_setups_item import PlanSpecSetupsItem


T = TypeVar("T", bound="PlanSpec")


@_attrs_define
class PlanSpec:
    """**Experimental.** Available now and still gaining functionality. It may change in breaking ways in a minor API
    release; each such change is listed in the release notes, so check them before upgrading.

    A plan stated by region index: the region space it is in, the regions it skips, the setups it starts with, and the
    features each must machine. Everything it leaves open, the planner fills in. A field left out takes its default. A
    plan read serves its own completed, every field written out and every feature’s type stated, to edit and send back.
    A spec holds at most 20,000 region indices over all its lists.

        Attributes:
            preparation_id (str): The region space every index here is in: the `preparationId` of the response the indices
                were read from — the part (`GET /v1/parts/{id}`), or a plan’s `planSpec`. A job that prepares the part otherwise
                — a later kernel release that numbers its regions differently, or another source file — fails, its `error`
                beginning `stale_regions:`.
            skipped_regions (list[int] | Unset): Regions no setup machines — already at their final surface, or not to be
                machined — as indices into the part’s `regions`. No feature planned holds one, and they are left out of the
                plan’s `issues`, machining times and toolpaths. Omit for none.
            setups (list[PlanSpecSetupsItem] | Unset): The plan’s first setups, in machining order. The planner may add
                setups after them, never before or between them. Omit for none: the planner chooses every setup.
            additional_directions (list[PlanSpecAdditionalDirectionsType0Item] | None | Unset): The directions the planner
                may add setups in, each one of the part’s `candidateDirections` exactly as served. Null or omitted for every one
                of them; `[]` adds no setup. Naming a stated setup’s direction changes nothing.
    """

    preparation_id: str
    skipped_regions: list[int] | Unset = UNSET
    setups: list[PlanSpecSetupsItem] | Unset = UNSET
    additional_directions: list[PlanSpecAdditionalDirectionsType0Item] | None | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        preparation_id = self.preparation_id

        skipped_regions: list[int] | Unset = UNSET
        if not isinstance(self.skipped_regions, Unset):
            skipped_regions = self.skipped_regions

        setups: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.setups, Unset):
            setups = []
            for setups_item_data in self.setups:
                setups_item = setups_item_data.to_dict()
                setups.append(setups_item)

        additional_directions: list[dict[str, Any]] | None | Unset
        if isinstance(self.additional_directions, Unset):
            additional_directions = UNSET
        elif isinstance(self.additional_directions, list):
            additional_directions = []
            for additional_directions_type_0_item_data in self.additional_directions:
                additional_directions_type_0_item = additional_directions_type_0_item_data.to_dict()
                additional_directions.append(additional_directions_type_0_item)

        else:
            additional_directions = self.additional_directions

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "preparationId": preparation_id,
            }
        )
        if skipped_regions is not UNSET:
            field_dict["skippedRegions"] = skipped_regions
        if setups is not UNSET:
            field_dict["setups"] = setups
        if additional_directions is not UNSET:
            field_dict["additionalDirections"] = additional_directions

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.plan_spec_additional_directions_type_0_item import PlanSpecAdditionalDirectionsType0Item
        from ..models.plan_spec_setups_item import PlanSpecSetupsItem

        d = dict(src_dict)
        preparation_id = d.pop("preparationId")

        skipped_regions = cast(list[int], d.pop("skippedRegions", UNSET))

        _setups = d.pop("setups", UNSET)
        setups: list[PlanSpecSetupsItem] | Unset = UNSET
        if _setups is not UNSET:
            setups = []
            for setups_item_data in _setups:
                setups_item = PlanSpecSetupsItem.from_dict(setups_item_data)

                setups.append(setups_item)

        def _parse_additional_directions(data: object) -> list[PlanSpecAdditionalDirectionsType0Item] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                additional_directions_type_0 = []
                _additional_directions_type_0 = data
                for additional_directions_type_0_item_data in _additional_directions_type_0:
                    additional_directions_type_0_item = PlanSpecAdditionalDirectionsType0Item.from_dict(
                        additional_directions_type_0_item_data
                    )

                    additional_directions_type_0.append(additional_directions_type_0_item)

                return additional_directions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[PlanSpecAdditionalDirectionsType0Item] | None | Unset, data)

        additional_directions = _parse_additional_directions(d.pop("additionalDirections", UNSET))

        plan_spec = cls(
            preparation_id=preparation_id,
            skipped_regions=skipped_regions,
            setups=setups,
            additional_directions=additional_directions,
        )

        return plan_spec
