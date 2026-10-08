from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.automatic_flat_bar_stock import AutomaticFlatBarStock
    from ..models.automatic_round_stock import AutomaticRoundStock
    from ..models.fixed_box_stock import FixedBoxStock
    from ..models.fixed_cylinder_stock import FixedCylinderStock
    from ..models.stock_box import StockBox
    from ..models.stock_cylinder import StockCylinder


T = TypeVar("T", bound="PlanResponseStock")


@_attrs_define
class PlanResponseStock:
    """The saved stock input and the initial geometry the kernel resolved from it.

    Attributes:
        input_ (AutomaticFlatBarStock | AutomaticRoundStock | FixedBoxStock | FixedCylinderStock): The stock policy the
            job cuts from, all lengths mm, with omitted figures left omitted. The request’s stock policy, or the saved input
            on a recalculation, or automatic Flat Bar on a new plan and a plan made before stock inputs were recorded. A
            recalculation without stock reuses this.
        resolved (None | StockBox | StockCylinder): The initial stock the kernel sized and placed, in mm, told apart by
            `shape`: a `box` — two corners in the first setup’s frame, squared up in the direction the job cuts first — or a
            `cylinder` in part coordinates. This is the material bought, which a quote is written against (a cylinder’s
            volume is π·(diameter/2)²·length); the part’s own bounding box is not a substitute. Null for a plan calculated
            before this field existed — re-run the part to get one — and for a part with no setup, which has nothing to
            square stock against.
    """

    input_: AutomaticFlatBarStock | AutomaticRoundStock | FixedBoxStock | FixedCylinderStock
    resolved: None | StockBox | StockCylinder
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.automatic_flat_bar_stock import AutomaticFlatBarStock
        from ..models.automatic_round_stock import AutomaticRoundStock
        from ..models.fixed_box_stock import FixedBoxStock
        from ..models.stock_box import StockBox
        from ..models.stock_cylinder import StockCylinder

        input_: dict[str, Any]
        if isinstance(self.input_, AutomaticFlatBarStock):
            input_ = self.input_.to_dict()
        elif isinstance(self.input_, AutomaticRoundStock):
            input_ = self.input_.to_dict()
        elif isinstance(self.input_, FixedBoxStock):
            input_ = self.input_.to_dict()
        else:
            input_ = self.input_.to_dict()

        resolved: dict[str, Any] | None
        if isinstance(self.resolved, StockBox):
            resolved = self.resolved.to_dict()
        elif isinstance(self.resolved, StockCylinder):
            resolved = self.resolved.to_dict()
        else:
            resolved = self.resolved

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "input": input_,
                "resolved": resolved,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.automatic_flat_bar_stock import AutomaticFlatBarStock
        from ..models.automatic_round_stock import AutomaticRoundStock
        from ..models.fixed_box_stock import FixedBoxStock
        from ..models.fixed_cylinder_stock import FixedCylinderStock
        from ..models.stock_box import StockBox
        from ..models.stock_cylinder import StockCylinder

        d = dict(src_dict)

        def _parse_input_(
            data: object,
        ) -> AutomaticFlatBarStock | AutomaticRoundStock | FixedBoxStock | FixedCylinderStock:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                input_type_0 = AutomaticFlatBarStock.from_dict(data)

                return input_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                input_type_1 = AutomaticRoundStock.from_dict(data)

                return input_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                input_type_2 = FixedBoxStock.from_dict(data)

                return input_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            input_type_3 = FixedCylinderStock.from_dict(data)

            return input_type_3

        input_ = _parse_input_(d.pop("input"))

        def _parse_resolved(data: object) -> None | StockBox | StockCylinder:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                resolved_type_0 = StockBox.from_dict(data)

                return resolved_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                resolved_type_1 = StockCylinder.from_dict(data)

                return resolved_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | StockBox | StockCylinder, data)

        resolved = _parse_resolved(d.pop("resolved"))

        plan_response_stock = cls(
            input_=input_,
            resolved=resolved,
        )

        plan_response_stock.additional_properties = d
        return plan_response_stock

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
