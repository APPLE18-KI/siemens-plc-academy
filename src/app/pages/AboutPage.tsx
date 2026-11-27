import React from 'react';
import { SOURCE_DOCS } from '../../content/sources';

const OSS: { name: string; license: string; note: string; url: string }[] = [
  {
    name: 'unfold',
    license: 'MIT License · Copyright (c) 2026 unfold contributors',
    note: '“讲课模式”（板书 + 一句一句的旁白 + 红色指针）、“四级折叠”（完整/精读/要点/结论）和“出处引用 chip”的设计思路来自 unfold。本站用 React 按手机操作重新实现，没有直接使用它的代码。',
    url: '',
  },
  {
    name: 'TextFold（chenxiachan）',
    license: '思路致谢',
    note: '按“骨架到全文”多级阅读同一篇文字的想法来自 TextFold；unfold 在此基础上用作者标记的关键句来折叠。本站沿用这一思路，不含 TextFold 代码。',
    url: 'https://github.com/chenxiachan/textfold',
  },
  { name: 'React / React DOM', license: 'MIT License', note: '界面框架', url: 'https://react.dev/' },
  { name: 'React Router', license: 'MIT License', note: '页面路由', url: 'https://reactrouter.com/' },
  { name: 'Lucide', license: 'ISC License', note: '图标', url: 'https://lucide.dev/' },
  { name: 'Capacitor', license: 'MIT License', note: '安卓 App 外壳、返回键、触感反馈、启动页', url: 'https://capacitorjs.com/' },
];

export const AboutPage: React.FC = () => (
  <div className="spa-container about-page">
    <h1>关于与开源许可</h1>
    <p>
      西门子 PLC 实训工坊 v3.0 是个人学习项目，<b>不是西门子官方产品</b>。SIEMENS、SIMATIC、TIA Portal、S7-PLCSIM 是西门子公司的商标。
      仿真器界面是本站自绘的简化教学版，参考了博途与 PLCSIM 的布局和行为，没有使用西门子软件截图或图标资源。
    </p>

    <h2>开源与致谢</h2>
    <ul className="about-list">
      {OSS.map((o) => (
        <li key={o.name}>
          <b>{o.name}</b>
          <span className="about-license">{o.license}</span>
          <span>{o.note}</span>
        </li>
      ))}
    </ul>
    <p className="about-small">
      unfold 的 MIT 许可：Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
      files (the "Software"), to deal in the Software without restriction… The above copyright notice and this permission notice shall be included in
      all copies or substantial portions of the Software.
    </p>

    <h2>引用的西门子资料</h2>
    <p>正文中的“出处”标签摘录自以下文档（短句引用，仅用于学习；以官方最新版本为准）：</p>
    <ul className="about-list">
      {Object.values(SOURCE_DOCS).map((d) => (
        <li key={d.id}>
          <b>{d.name}</b>
          <span className="about-license">{d.version}</span>
          <span className="about-url">{d.url}</span>
        </li>
      ))}
    </ul>

    <h2>隐私与离线数据迁移</h2>
    <p>
      课程进度、随堂笔记、复习卡片、错题本与毕业项目打卡记录全部只保存在本机（浏览器 localStorage / App 本地存储），不上传任何服务器；App 不申请联网权限。
      如需在电脑与手机之间同步进度，可在顶部“综合掌握度”学习档案面板中一键导出/导入本地 JSON 备份文件。
    </p>
  </div>
);
