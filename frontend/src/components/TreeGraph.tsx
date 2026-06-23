import { useEffect, useRef, useState } from 'react';
import { hierarchy, HierarchyPointNode, tree } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { linkHorizontal } from 'd3-shape';
import axios from 'axios';
import { Box, Spinner, Text } from '@chakra-ui/react';

interface TreeNode {
  id: number;
  taskId: string;
  nom: string;
  children?: TreeNode[];
}

interface TreeGraphProps {
  rootId: number;
}

export default function TreeGraph({ rootId }: TreeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions] = useState({ width: 600, height: 400 });
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await axios.get<TreeNode>(`/api/types/tree?rootId=${rootId}`);
        setTreeData(res.data);
      } catch (e) {
        console.error('Error de récupération du graphe :', e);
      } finally {
        setLoading(false);
      }
    };

    if (rootId) {
      fetchTree();
    }
  }, [rootId]);

  useEffect(() => {
    if (!treeData || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const root = hierarchy(treeData);
    const layout = tree<TreeNode>().size([dimensions.height, dimensions.width - 100]);
    const positionedRoot = layout(root) as unknown as HierarchyPointNode<TreeNode>;


    const linkGenerator = linkHorizontal<HierarchyPointNode<TreeNode>, HierarchyPointNode<TreeNode>>()
        .x(d => d.y)
        .y(d => d.x);


    svg.append('g')
        .selectAll('path')
        .data(positionedRoot.links())
        .join('path')
        .attr('fill', 'none')
        .attr('stroke', '#555')
        .attr('stroke-width', 1.5)
        .attr('d', (d: any) => linkGenerator(d));


    const nodeGroup = svg.append('g')
        .selectAll('g')
        .data(positionedRoot.descendants())
        .join('g')
        .attr('transform', (d: HierarchyPointNode<TreeNode>) => `translate(${d.y},${d.x})`);


    nodeGroup.append('circle')
        .attr('r', 6)
        .attr('fill', '#3182ce');

    nodeGroup.append('text')
        .attr('dy', '0.31em')
        .attr('x', d => d.children ? -10 : 10)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .text(d => `${d.data.taskId} - ${d.data.nom}`)
        .clone(true).lower()
        .attr('stroke', 'white');

  }, [treeData, dimensions]);

  return (
      <Box overflow="auto" border="1px" borderColor="gray.200" p={2}>
        {loading && <Spinner />}
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height}></svg>
        {!loading && !treeData && <Text mt={2} color="gray.500">Aucune donnée</Text>}
      </Box>
  );
}
