from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define

from ..models.part_job_request_material import PartJobRequestMaterial
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.automatic_flat_bar_stock import AutomaticFlatBarStock
    from ..models.automatic_round_stock import AutomaticRoundStock
    from ..models.fixed_box_stock import FixedBoxStock
    from ..models.fixed_cylinder_stock import FixedCylinderStock
    from ..models.part_job_request_done_regions_type_0 import PartJobRequestDoneRegionsType0
    from ..models.part_job_request_machine import PartJobRequestMachine
    from ..models.part_job_request_setup_plan_type_0 import PartJobRequestSetupPlanType0
    from ..models.part_job_request_tool_crib_item_type_0 import PartJobRequestToolCribItemType0


T = TypeVar("T", bound="PartJobRequest")


@_attrs_define
class PartJobRequest:
    """
    Attributes:
        material (PartJobRequestMaterial | Unset): The material to synthesize tools and machining times for. Omit for
            aluminium, the default. Example: LowCarbonSteel.
        tool_crib (list[PartJobRequestToolCribItemType0] | Unset): Where tools come from: a tool crib of one to sixteen
            tool libraries, in priority order — each pass of the plan uses the first library with a tool for it. Each
            library has a `kind`; today the only kind is `implicit`, a library whose tools are synthesized from settings
            (explicit libraries of catalog tools will follow). An implicit library has an optional `name` (a label) and
            enables tool families (faceMill, flatEndmill, bullNose, ballEndmill, drill, chamfer, keyseat, tap,
            cornerRounding), and each family has its own settings for inch-sized tools and for metric ones — a face mill
            diameter, diameter ranges and a maximum length-over-diameter, in millimetres; any setting left out takes its
            default. A family left out is not made, and planning falls back where it can: without drills, holes are milled;
            without a face mill, facing uses a flat endmill; without chamfer mills, bevels are followed by a bullnose, then
            a ball. Endmill `minDiameter` is a hard minimum. Inch drills are the fractional, number and letter series, and
            metric drills the metric series; a library enabling both makes the nearest stocked size of either, one drill per
            hole, unless its two blocks state different `maxLengthOverDiameter`, when each system's drills are made
            separately. A drill block that states no `maxDiameter` stocks its whole series, to 4 1/4" and 57 mm. Corner-
            rounding diameters are the whole cutter. `tap` is every tool that cuts a thread — cutting and forming taps, and
            thread mills — each made only for a threaded hole of the process its thread names, a tap at a standard thread
            size; a thread with no tool for it is planned without its thread, which is reported owed. Omit for one implicit
            library with every family inch-sized at its defaults, corner rounders off, and drills in both systems with
            `maxDiameter` stated at 50.8 (2") and 50 — a part's units are not known before it is uploaded, so a hole takes
            the nearest stocked drill of either. Example: [{'kind': 'implicit', 'name': 'Inch endmills, drills in both',
            'flatEndmill': {'enabled': True, 'inch': {'enabled': True, 'minDiameter': 3.175, 'maxDiameter': 19.05}},
            'drill': {'enabled': True, 'inch': {'enabled': True, 'maxDiameter': 50.8}, 'metric': {'enabled': True,
            'maxDiameter': 50}}}].
        machine (PartJobRequestMachine | Unset): The machine the part is quoted on: `name`, `maxRpm` (the spindle's top
            speed, rev/min) and `toolChangeSeconds`. Recorded with the plan and echoed back, and carried over by a
            recalculation. `maxRpm` is applied: every synthesized tool is held under it, so machining times move for a
            machine that states one; without it a default ceiling of 15000 rev/min applies. Tool changes are never included
            in machining times; `toolChangeSeconds` is for the caller to price them. Omit for none. Example: {'name': 'Haas
            VF-2', 'maxRpm': 8100, 'toolChangeSeconds': 4.2}.
        setup_plan (None | PartJobRequestSetupPlanType0 | Unset): The setup plan to extend: setups in machining order,
            each with one `orientations` entry — a 3-axis setup; features are measured in thin air, which holds one
            direction per setup, so a 3+2 setup is not stated yet — naming the features (`featureTag`, hex) to machine from
            its `direction`. A direction must be one a feature of the part was extracted from, passed back exactly as served
            (a unit vector), and a feature is named under its own direction. The plan made keeps these setups first, in this
            order, each holding at least the features named (and every other offered feature of its direction), and appends
            setups where the part needs more. A plan read serves its own `setupPlan`, which can be edited and sent back.
            Tags are stable only within one `kernelVersion`, and a feature named has to be offered: one no tool in the crib
            cuts is not. A statement the kernel cannot honor fails the job, whose `error` begins `refused_user_plan:` and
            gives one clause per refused statement. Omit or null for the kernel’s own plan; on **Calculate a plan’s
            toolpaths**, omit to keep the plan’s statement and null to clear it. Example: {'setups': [{'orientations':
            [{'direction': {'x': 0, 'y': 0, 'z': 1}, 'features': ['1f3a09c2']}]}, {'orientations': [{'direction': {'x': 0,
            'y': 0, 'z': -1}, 'features': []}]}]}.
        done_regions (None | PartJobRequestDoneRegionsType0 | Unset): Regions already at their final surface — near-net
            stock, a face finished before the part arrives: `regions`, indices into the part report’s `regions`, and the
            `kernelVersion` of the report they were read from. Region indices are stable only within one kernel release, so
            a job planned by another fails, its `error` beginning `stale_regions:`; an index the part does not have fails it
            as `unknown_regions:`. A done region is left out of the plan’s `issues`, its machining times and its toolpaths.
            A feature whose regions are all done is not planned, unless `setupPlan` names it — then it is machined, and its
            regions still do not count toward `issues`. A done region on the top of a direction turns off facing from that
            direction, and the part’s other top faces are machined one by one. The stock is unchanged: it is still the block
            around the part, so the simulation cuts air over a done region. Omit or null for none; on **Calculate a plan’s
            toolpaths**, omit to keep the plan’s and null to clear them. Example: {'kernelVersion': '0.18.0', 'regions':
            [12, 13]}.
        stock (AutomaticFlatBarStock | AutomaticRoundStock | FixedBoxStock | FixedCylinderStock | Unset): Initial stock
            settings. Omit stock to use automatic Flat Bar on a new plan or keep the saved input on a recalculation. The
            initial stock to cut from, all lengths mm, told apart by `mode`: automatic Flat Bar or Round Stock sized around
            the part, or a fixed block or cylinder placed against it. Omit it on a new plan for automatic Flat Bar at the
            default figures; omit it when recalculating a plan to reuse that plan’s own. Example: {'mode':
            'automaticFlatBar', 'oversizeX': 1}.
        fallback_tools (bool | Unset): Plan what the tool crib cannot. A pass no tool of the crib can play — a hole
            deeper than its drills reach, a pocket past its endmills’ `maxLengthOverDiameter`, a head no library lists — is
            given a tool from a last, fallback tier with the reach limits lifted, so the part has a time for it. The crib
            comes first: a pass any crib tool can play keeps that tool. Each fallback tool is marked `outsideCrib` on the
            plan’s actions, with why the crib had none. Omit or false for today’s plans, which leave such passes
            `unmachined`. Not carried by a recalculation: state it on each request that wants it. Example: True.
    """

    material: PartJobRequestMaterial | Unset = UNSET
    tool_crib: list[PartJobRequestToolCribItemType0] | Unset = UNSET
    machine: PartJobRequestMachine | Unset = UNSET
    setup_plan: None | PartJobRequestSetupPlanType0 | Unset = UNSET
    done_regions: None | PartJobRequestDoneRegionsType0 | Unset = UNSET
    stock: AutomaticFlatBarStock | AutomaticRoundStock | FixedBoxStock | FixedCylinderStock | Unset = UNSET
    fallback_tools: bool | Unset = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.automatic_flat_bar_stock import AutomaticFlatBarStock
        from ..models.automatic_round_stock import AutomaticRoundStock
        from ..models.fixed_box_stock import FixedBoxStock
        from ..models.part_job_request_done_regions_type_0 import PartJobRequestDoneRegionsType0
        from ..models.part_job_request_setup_plan_type_0 import PartJobRequestSetupPlanType0
        from ..models.part_job_request_tool_crib_item_type_0 import PartJobRequestToolCribItemType0

        material: str | Unset = UNSET
        if not isinstance(self.material, Unset):
            material = self.material.value

        tool_crib: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.tool_crib, Unset):
            tool_crib = []
            for tool_crib_item_data in self.tool_crib:
                tool_crib_item: dict[str, Any]
                if isinstance(tool_crib_item_data, PartJobRequestToolCribItemType0):
                    tool_crib_item = tool_crib_item_data.to_dict()

                tool_crib.append(tool_crib_item)

        machine: dict[str, Any] | Unset = UNSET
        if not isinstance(self.machine, Unset):
            machine = self.machine.to_dict()

        setup_plan: dict[str, Any] | None | Unset
        if isinstance(self.setup_plan, Unset):
            setup_plan = UNSET
        elif isinstance(self.setup_plan, PartJobRequestSetupPlanType0):
            setup_plan = self.setup_plan.to_dict()
        else:
            setup_plan = self.setup_plan

        done_regions: dict[str, Any] | None | Unset
        if isinstance(self.done_regions, Unset):
            done_regions = UNSET
        elif isinstance(self.done_regions, PartJobRequestDoneRegionsType0):
            done_regions = self.done_regions.to_dict()
        else:
            done_regions = self.done_regions

        stock: dict[str, Any] | Unset
        if isinstance(self.stock, Unset):
            stock = UNSET
        elif isinstance(self.stock, AutomaticFlatBarStock):
            stock = self.stock.to_dict()
        elif isinstance(self.stock, AutomaticRoundStock):
            stock = self.stock.to_dict()
        elif isinstance(self.stock, FixedBoxStock):
            stock = self.stock.to_dict()
        else:
            stock = self.stock.to_dict()

        fallback_tools = self.fallback_tools

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if material is not UNSET:
            field_dict["material"] = material
        if tool_crib is not UNSET:
            field_dict["toolCrib"] = tool_crib
        if machine is not UNSET:
            field_dict["machine"] = machine
        if setup_plan is not UNSET:
            field_dict["setupPlan"] = setup_plan
        if done_regions is not UNSET:
            field_dict["doneRegions"] = done_regions
        if stock is not UNSET:
            field_dict["stock"] = stock
        if fallback_tools is not UNSET:
            field_dict["fallbackTools"] = fallback_tools

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.automatic_flat_bar_stock import AutomaticFlatBarStock
        from ..models.automatic_round_stock import AutomaticRoundStock
        from ..models.fixed_box_stock import FixedBoxStock
        from ..models.fixed_cylinder_stock import FixedCylinderStock
        from ..models.part_job_request_done_regions_type_0 import PartJobRequestDoneRegionsType0
        from ..models.part_job_request_machine import PartJobRequestMachine
        from ..models.part_job_request_setup_plan_type_0 import PartJobRequestSetupPlanType0
        from ..models.part_job_request_tool_crib_item_type_0 import PartJobRequestToolCribItemType0

        d = dict(src_dict)
        _material = d.pop("material", UNSET)
        material: PartJobRequestMaterial | Unset
        if isinstance(_material, Unset):
            material = UNSET
        else:
            material = PartJobRequestMaterial(_material)

        _tool_crib = d.pop("toolCrib", UNSET)
        tool_crib: list[PartJobRequestToolCribItemType0] | Unset = UNSET
        if _tool_crib is not UNSET:
            tool_crib = []
            for tool_crib_item_data in _tool_crib:

                def _parse_tool_crib_item(data: object) -> PartJobRequestToolCribItemType0:
                    if not isinstance(data, dict):
                        raise TypeError()
                    tool_crib_item_type_0 = PartJobRequestToolCribItemType0.from_dict(data)

                    return tool_crib_item_type_0

                tool_crib_item = _parse_tool_crib_item(tool_crib_item_data)

                tool_crib.append(tool_crib_item)

        _machine = d.pop("machine", UNSET)
        machine: PartJobRequestMachine | Unset
        if isinstance(_machine, Unset):
            machine = UNSET
        else:
            machine = PartJobRequestMachine.from_dict(_machine)

        def _parse_setup_plan(data: object) -> None | PartJobRequestSetupPlanType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                setup_plan_type_0 = PartJobRequestSetupPlanType0.from_dict(data)

                return setup_plan_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PartJobRequestSetupPlanType0 | Unset, data)

        setup_plan = _parse_setup_plan(d.pop("setupPlan", UNSET))

        def _parse_done_regions(data: object) -> None | PartJobRequestDoneRegionsType0 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                done_regions_type_0 = PartJobRequestDoneRegionsType0.from_dict(data)

                return done_regions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PartJobRequestDoneRegionsType0 | Unset, data)

        done_regions = _parse_done_regions(d.pop("doneRegions", UNSET))

        def _parse_stock(
            data: object,
        ) -> AutomaticFlatBarStock | AutomaticRoundStock | FixedBoxStock | FixedCylinderStock | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                stock_type_0 = AutomaticFlatBarStock.from_dict(data)

                return stock_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                stock_type_1 = AutomaticRoundStock.from_dict(data)

                return stock_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                stock_type_2 = FixedBoxStock.from_dict(data)

                return stock_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            stock_type_3 = FixedCylinderStock.from_dict(data)

            return stock_type_3

        stock = _parse_stock(d.pop("stock", UNSET))

        fallback_tools = d.pop("fallbackTools", UNSET)

        part_job_request = cls(
            material=material,
            tool_crib=tool_crib,
            machine=machine,
            setup_plan=setup_plan,
            done_regions=done_regions,
            stock=stock,
            fallback_tools=fallback_tools,
        )

        return part_job_request
