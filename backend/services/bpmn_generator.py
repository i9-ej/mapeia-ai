import xml.etree.ElementTree as ET
from xml.dom import minidom
import uuid


BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
DI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"


def build_bpmn_xml(process_analysis: dict) -> str:
    """
    Build a valid BPMN 2.0 XML from process analysis dict.
    Uses structured generation (not AI) as a fallback / validator.
    """
    ET.register_namespace("", BPMN_NS)
    ET.register_namespace("bpmndi", BPMNDI_NS)
    ET.register_namespace("dc", DC_NS)
    ET.register_namespace("di", DI_NS)

    root = ET.Element(f"{{{BPMN_NS}}}definitions", {
        "xmlns": BPMN_NS,
        "xmlns:bpmndi": BPMNDI_NS,
        "xmlns:dc": DC_NS,
        "xmlns:di": DI_NS,
        "targetNamespace": "http://clinicflow.io/bpmn",
        "id": "Definitions_1"
    })

    process_id = "Process_1"
    process_name = process_analysis.get("process_name", "Processo AS-IS")
    steps = process_analysis.get("steps", [])
    actors = process_analysis.get("actors", [])

    process_elem = ET.SubElement(root, f"{{{BPMN_NS}}}process", {
        "id": process_id,
        "name": process_name,
        "isExecutable": "false"
    })

    # Create collaboration and participants if we have actors
    if actors:
        collab = ET.SubElement(root, f"{{{BPMN_NS}}}collaboration", {"id": "Collaboration_1"})
        for i, actor in enumerate(actors[:8]):  # max 8 lanes
            ET.SubElement(collab, f"{{{BPMN_NS}}}participant", {
                "id": f"Participant_{i+1}",
                "name": actor,
                "processRef": process_id
            })

    # Add start event
    start_event = ET.SubElement(process_elem, f"{{{BPMN_NS}}}startEvent", {
        "id": "StartEvent_1",
        "name": "Início"
    })

    # Add tasks and gateways from steps
    element_ids = {"start": "StartEvent_1"}
    prev_id = "StartEvent_1"

    for step in steps[:20]:  # max 20 steps
        step_id = step.get("id", f"Task_{uuid.uuid4().hex[:6]}")
        step_name = step.get("name", "Tarefa")
        step_type = step.get("type", "task")

        if step_type == "decision":
            elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}exclusiveGateway", {
                "id": step_id,
                "name": step_name
            })
        elif step_type == "end":
            elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}endEvent", {
                "id": step_id,
                "name": step_name
            })
        else:
            elem = ET.SubElement(process_elem, f"{{{BPMN_NS}}}task", {
                "id": step_id,
                "name": step_name
            })

        # Add sequence flow from prev to current
        flow_id = f"Flow_{prev_id}_{step_id}"
        ET.SubElement(process_elem, f"{{{BPMN_NS}}}sequenceFlow", {
            "id": flow_id,
            "sourceRef": prev_id,
            "targetRef": step_id
        })
        element_ids[step_id] = step_id
        prev_id = step_id

    # Add end event if last step wasn't an end
    if steps and steps[-1].get("type") != "end":
        end_id = "EndEvent_1"
        ET.SubElement(process_elem, f"{{{BPMN_NS}}}endEvent", {
            "id": end_id,
            "name": "Fim"
        })
        ET.SubElement(process_elem, f"{{{BPMN_NS}}}sequenceFlow", {
            "id": f"Flow_{prev_id}_{end_id}",
            "sourceRef": prev_id,
            "targetRef": end_id
        })
    elif not steps:
        # Minimal: start -> end
        end_id = "EndEvent_1"
        ET.SubElement(process_elem, f"{{{BPMN_NS}}}endEvent", {"id": end_id, "name": "Fim"})
        ET.SubElement(process_elem, f"{{{BPMN_NS}}}sequenceFlow", {
            "id": "Flow_Start_End",
            "sourceRef": "StartEvent_1",
            "targetRef": end_id
        })

    xml_str = ET.tostring(root, encoding="unicode")
    return minidom.parseString(xml_str).toprettyxml(indent="  ")
