#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import os
import sys
from argparse import ArgumentParser


def json_to_markdown(json_file_path, output_file_path=None):
    """
    将JSON文件转换为Markdown格式

    参数:
    json_file_path: JSON文件路径
    output_file_path: 输出Markdown文件路径，如果为None，则使用JSON文件名+.md
    """
    # 确定输出文件路径
    # 修改: 如果未指定输出文件名，则使用输入文件名去掉后缀并添加 .md
    if not output_file_path:
        base_name = os.path.splitext(json_file_path)[0]
        output_file_path = f"{base_name}.md"

    try:
        # 读取JSON文件
        with open(json_file_path, "r", encoding="utf-8") as file:
            data = json.load(file)

        # 检查数据是否为字典
        if not isinstance(data, dict):
            print(f"错误: 输入文件不是有效的JSON对象: {json_file_path}")
            return False

        # 创建Markdown内容
        markdown_content = ""

        # 遍历每个字段并转换为Markdown格式
        for key, value in data.items():
            if isinstance(value, str):
                markdown_content += f"# {key}\n\n{value}\n\n"
            else:
                # 如果值不是字符串，将其格式化为JSON字符串
                value_str = json.dumps(value, ensure_ascii=False, indent=2)
                markdown_content += f"# {key}\n\n```json\n{value_str}\n```\n\n"

        # 写入Markdown文件
        with open(output_file_path, "w", encoding="utf-8") as file:
            file.write(markdown_content)

        print(f"成功将 {json_file_path} 转换为 {output_file_path}")
        return True

    except json.JSONDecodeError:
        print(f"错误: 无法解析JSON文件: {json_file_path}")
        return False
    except IOError as e:
        print(f"错误: 无法读取或写入文件: {e}")
        return False


def main():
    parser = ArgumentParser(description="将JSON文件转换为Markdown格式")
    # 修改: 默认输入文件名为 "E:\Data\题库\全国_省级数学竞赛形式化题库\format_1.json"
    parser.add_argument(
        "input_file",
        nargs="?",
        default=r"E:\Data\题库\全国_省级数学竞赛形式化题库\format_1.json",
        help="输入的JSON文件路径",
    )
    parser.add_argument("-o", "--output", help="输出的Markdown文件路径")

    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print(f"错误: 输入文件不存在: {args.input_file}")
        sys.exit(1)

    success = json_to_markdown(args.input_file, args.output)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
