import styles from "./PaintTakeoverSection.module.css";

export function PaintTakeoverArtwork() {
  return (
    <svg
      aria-hidden="true"
      className={styles.svg}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1920 1080"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="proof-magenta" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a80932" />
          <stop offset="0.5" stopColor="#ee086f" />
          <stop offset="1" stopColor="#ff4aa2" />
        </linearGradient>
        <linearGradient id="proof-blue" x1="1" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0b8cff" />
          <stop offset="0.55" stopColor="#3431d6" />
          <stop offset="1" stopColor="#7134d5" />
        </linearGradient>
        <linearGradient id="proof-red" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor="#a80932" />
          <stop offset="0.58" stopColor="#db2435" />
          <stop offset="1" stopColor="#ee086f" />
        </linearGradient>
        <linearGradient id="proof-soft-mask-ltr" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" />
          <stop offset="0.9" stopColor="white" />
          <stop offset="1" stopColor="rgb(255 255 255 / 0)" />
        </linearGradient>
        <linearGradient id="proof-soft-mask-rtl" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="white" />
          <stop offset="0.9" stopColor="white" />
          <stop offset="1" stopColor="rgb(255 255 255 / 0)" />
        </linearGradient>
        <radialGradient id="proof-cloud-magenta">
          <stop offset="0" stopColor="#ee086f" stopOpacity="0.62" />
          <stop offset="0.5" stopColor="#ee086f" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ee086f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="proof-cloud-blue">
          <stop offset="0" stopColor="#0b8cff" stopOpacity="0.58" />
          <stop offset="0.54" stopColor="#3431d6" stopOpacity="0.2" />
          <stop offset="1" stopColor="#3431d6" stopOpacity="0" />
        </radialGradient>
        <filter id="proof-soft-cloud" x="-24%" y="-30%" width="148%" height="160%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="proof-mist-blur" x="-18%" y="-30%" width="136%" height="160%">
          <feGaussianBlur stdDeviation="38" />
        </filter>

        <mask id="proof-mask-01" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <rect
            data-mask-for="proof-stroke-01"
            fill="url(#proof-soft-mask-ltr)"
            height="1080"
            width="1920"
            x="0"
            y="0"
          />
          <path d="M-40 706 C210 692 470 708 690 738 L650 750 C420 724 210 716 -38 732Z" fill="black" />
          <path d="M410 764 C640 772 860 806 1048 814 L1002 824 C790 812 610 788 438 782Z" fill="black" />
          <path d="M1120 770 C1320 788 1510 768 1700 730 L1650 750 C1470 786 1300 796 1150 784Z" fill="black" />
          <path d="M1540 702 C1710 680 1860 646 2024 604 L1970 628 C1810 672 1690 696 1570 714Z" fill="black" />
          <path d="M100 752 C220 738 320 744 410 758 L372 764 C270 752 190 752 118 762ZM742 722 C840 730 940 746 1020 756 L978 762 C890 750 820 742 754 734ZM1720 758 C1830 738 1920 712 2010 684 L1972 706 C1880 734 1810 750 1740 766Z" fill="black" />
        </mask>
        <mask id="proof-mask-02" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <rect
            data-mask-for="proof-stroke-02"
            fill="url(#proof-soft-mask-rtl)"
            height="1080"
            width="1920"
            x="0"
            y="0"
          />
          <path d="M1960 146 C1710 180 1490 222 1274 270 L1318 278 C1510 238 1710 206 1934 176Z" fill="black" />
          <path d="M1500 312 C1240 354 1040 400 842 430 L886 438 C1080 414 1260 380 1460 336Z" fill="black" />
          <path d="M742 374 C520 414 340 436 132 436 L176 450 C360 450 530 430 706 394Z" fill="black" />
          <path d="M1790 202 C1650 218 1510 246 1380 274 L1426 278 C1540 254 1650 232 1760 218ZM1070 344 C950 366 850 388 752 402 L792 408 C890 396 980 378 1040 360ZM300 392 C180 402 64 402 -52 392 L-18 406 C92 414 192 410 270 402Z" fill="black" />
        </mask>
        <mask id="proof-mask-03" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <path
            data-mask-path-for="proof-stroke-03"
            d="M-120 930 C420 900 760 840 1120 850 C1450 860 1710 805 2040 735"
            fill="none"
            pathLength="1"
            stroke="white"
            strokeDasharray="1"
            strokeDashoffset="1"
            strokeLinecap="butt"
            strokeWidth="280"
          />
          <path d="M-30 890 C240 884 480 876 700 880 L662 896 C430 894 220 900 -10 912Z" fill="black" />
          <path d="M740 858 C970 864 1150 886 1340 878 L1290 894 C1110 900 950 880 774 874Z" fill="black" />
          <path d="M1390 846 C1590 836 1760 804 1960 754 L1910 784 C1730 830 1570 854 1424 862Z" fill="black" />
          <path d="M250 924 C380 912 510 912 632 920 L598 932 C470 926 360 930 270 938ZM1090 920 C1230 924 1360 916 1470 900 L1434 914 C1320 932 1210 934 1110 930ZM1680 866 C1790 844 1890 816 1990 782 L1950 804 C1850 840 1770 858 1700 876Z" fill="black" />
        </mask>
        <mask id="proof-mask-04" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <rect
            data-mask-for="proof-stroke-04"
            fill="url(#proof-soft-mask-ltr)"
            height="1080"
            width="1920"
            x="0"
            y="0"
          />
        </mask>
        <mask id="proof-mask-05" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <rect
            data-mask-for="proof-stroke-05"
            fill="url(#proof-soft-mask-rtl)"
            height="1080"
            width="1920"
            x="0"
            y="0"
          />
        </mask>
        <mask id="proof-mask-06" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <path
            data-mask-path-for="proof-stroke-06"
            d="M-150 995 C330 885 690 815 1040 830 C1420 845 1690 760 2070 650"
            fill="none"
            pathLength="1"
            stroke="white"
            strokeDasharray="1"
            strokeDashoffset="1"
            strokeLinecap="butt"
            strokeWidth="200"
          />
          <path d="M-30 960 C220 904 450 862 670 840 L628 858 C400 888 210 928 -10 980Z" fill="black" />
          <path d="M760 824 C960 816 1140 840 1310 824 L1264 840 C1090 854 940 832 792 838Z" fill="black" />
          <path d="M1380 800 C1580 770 1770 720 1990 650 L1940 678 C1730 744 1570 786 1414 814Z" fill="black" />
          <path d="M260 940 C400 904 520 878 650 864 L612 878 C480 900 380 924 280 952ZM1000 854 C1120 858 1230 852 1340 836 L1300 850 C1190 868 1100 868 1020 864ZM1660 762 C1770 732 1880 694 1990 656 L1950 678 C1840 718 1760 746 1680 772Z" fill="black" />
        </mask>
        <mask id="proof-mask-07" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
          <path
            data-mask-path-for="proof-stroke-07"
            d="M560 -110 C420 170 470 360 610 520 C770 705 645 875 430 1170"
            fill="none"
            pathLength="1"
            stroke="white"
            strokeDasharray="1"
            strokeDashoffset="1"
            strokeLinecap="butt"
            strokeWidth="170"
          />
          <path d="M522 -4 C464 160 478 296 548 414 L566 386 C506 276 500 160 542 20Z" fill="black" />
          <path d="M614 506 C700 650 668 792 566 934 L590 908 C682 780 712 656 630 530Z" fill="black" />
          <path d="M540 966 C500 1032 462 1098 418 1172 L446 1140 C486 1084 526 1020 556 986Z" fill="black" />
        </mask>
        <mask id="proof-hero-brush-texture" maskUnits="userSpaceOnUse" x="700" y="130" width="1400" height="700">
          <path
            d="M738 756 L790 718 L828 714 L812 702 L858 698 L842 686 L888 676 C1070 622 1268 548 1452 468 C1634 390 1814 306 2058 180 L2032 230 L1994 252 L2008 260 L1970 272 L1980 282 L1936 292 C1762 372 1604 444 1446 516 C1260 594 1074 662 894 718 L852 722 L870 734 L824 736 L842 746 L792 750Z"
            fill="white"
          />
          <path d="M800 726 C1002 664 1190 598 1362 528 M1412 508 C1604 426 1770 350 1936 270" fill="none" stroke="black" strokeLinecap="butt" strokeWidth="11" />
          <path d="M848 704 C982 664 1108 620 1224 576 M1280 554 C1414 502 1532 450 1642 398 M1694 374 C1798 328 1890 284 1980 238" fill="none" stroke="black" strokeLinecap="butt" strokeWidth="5" />
          <path d="M934 704 C1066 658 1186 614 1298 570 M1350 550 C1462 504 1568 456 1668 410 M1724 384 C1816 342 1902 300 1990 258" fill="none" stroke="black" strokeLinecap="butt" strokeWidth="3" />
          <ellipse cx="786" cy="728" fill="black" rx="28" ry="7" transform="rotate(-20 786 728)" />
          <ellipse cx="830" cy="746" fill="black" rx="20" ry="5" transform="rotate(-18 830 746)" />
          <ellipse cx="1986" cy="250" fill="black" rx="30" ry="6" transform="rotate(-24 1986 250)" />
          <ellipse cx="2020" cy="214" fill="black" rx="18" ry="4" transform="rotate(-24 2020 214)" />
        </mask>
      </defs>

      <g
        id="proof-stroke-18"
        className={`paint-stroke paint-stroke--mist ${styles.stroke} ${styles.mist}`}
        data-index="18"
        data-family="mist"
        data-direction="left-to-right"
        data-depth="background"
        data-entry="mist"
      >
        <ellipse cx="830" cy="650" fill="#7134d5" filter="url(#proof-mist-blur)" opacity="0.34" rx="880" ry="250" />
        <ellipse cx="1510" cy="580" fill="#ee086f" filter="url(#proof-mist-blur)" opacity="0.18" rx="600" ry="210" />
        <ellipse cx="1420" cy="820" fill="#0b8cff" filter="url(#proof-mist-blur)" opacity="0.18" rx="560" ry="180" />
      </g>

      <g
        id="proof-stroke-12"
        className={`paint-stroke paint-stroke--spray-cloud ${styles.stroke} ${styles.cloudMagenta}`}
        data-index="12"
        data-family="spray-cloud"
        data-direction="left-to-right"
        data-depth="background"
        data-entry="scale-opacity"
      >
        <g className={styles.cloudCore} filter="url(#proof-soft-cloud)">
          <ellipse cx="420" cy="590" fill="url(#proof-cloud-magenta)" rx="390" ry="190" />
          <ellipse cx="720" cy="650" fill="url(#proof-cloud-magenta)" rx="300" ry="150" />
          <ellipse cx="130" cy="720" fill="url(#proof-cloud-magenta)" rx="250" ry="130" />
        </g>
        <circle cx="70" cy="530" fill="#ff4aa2" opacity="0.34" r="5" />
        <circle cx="118" cy="660" fill="#ee086f" opacity="0.52" r="2.5" />
        <circle cx="176" cy="575" fill="#ff4aa2" opacity="0.36" r="8" />
        <circle cx="248" cy="730" fill="#a80932" opacity="0.42" r="4" />
        <circle cx="322" cy="520" fill="#ee086f" opacity="0.48" r="3" />
        <circle cx="398" cy="685" fill="#ff4aa2" opacity="0.38" r="7" />
        <circle cx="486" cy="560" fill="#ee086f" opacity="0.44" r="2" />
        <circle cx="552" cy="748" fill="#ff4aa2" opacity="0.32" r="5" />
        <circle cx="630" cy="605" fill="#a80932" opacity="0.46" r="3.5" />
        <circle cx="724" cy="698" fill="#ee086f" opacity="0.34" r="9" />
        <circle cx="810" cy="570" fill="#ff4aa2" opacity="0.4" r="3" />
        <ellipse cx="278" cy="630" fill="#ee086f" opacity="0.36" rx="15" ry="4" transform="rotate(-14 278 630)" />
        <ellipse cx="660" cy="770" fill="#ff4aa2" opacity="0.3" rx="12" ry="3" transform="rotate(18 660 770)" />
      </g>

      <g
        id="proof-stroke-13"
        className={`paint-stroke paint-stroke--spray-cloud ${styles.stroke} ${styles.cloudBlue}`}
        data-index="13"
        data-family="spray-cloud"
        data-direction="right-to-left"
        data-depth="background"
        data-entry="scale-opacity"
      >
        <g className={styles.cloudCore} filter="url(#proof-soft-cloud)">
          <ellipse cx="1510" cy="720" fill="url(#proof-cloud-blue)" rx="430" ry="220" />
          <ellipse cx="1770" cy="580" fill="url(#proof-cloud-blue)" rx="300" ry="170" />
          <ellipse cx="1220" cy="830" fill="url(#proof-cloud-blue)" rx="260" ry="130" />
        </g>
        <circle cx="1130" cy="760" fill="#0b8cff" opacity="0.34" r="4" />
        <circle cx="1200" cy="690" fill="#3edcf0" opacity="0.42" r="2.5" />
        <circle cx="1280" cy="820" fill="#3431d6" opacity="0.46" r="7" />
        <circle cx="1370" cy="640" fill="#0b8cff" opacity="0.4" r="3" />
        <circle cx="1450" cy="790" fill="#3edcf0" opacity="0.48" r="5" />
        <circle cx="1535" cy="600" fill="#0b8cff" opacity="0.36" r="8" />
        <circle cx="1625" cy="745" fill="#3431d6" opacity="0.46" r="3" />
        <circle cx="1710" cy="650" fill="#3edcf0" opacity="0.38" r="6" />
        <circle cx="1805" cy="805" fill="#0b8cff" opacity="0.42" r="4" />
        <circle cx="1880" cy="590" fill="#3edcf0" opacity="0.32" r="2" />
        <ellipse cx="1330" cy="714" fill="#3edcf0" opacity="0.34" rx="14" ry="4" transform="rotate(16 1330 714)" />
        <ellipse cx="1830" cy="700" fill="#0b8cff" opacity="0.34" rx="16" ry="4" transform="rotate(-20 1830 700)" />
        <circle cx="1068" cy="706" fill="#3edcf0" opacity="0.3" r="2" />
        <circle cx="1188" cy="594" fill="#0b8cff" opacity="0.38" r="5" />
        <circle cx="1322" cy="748" fill="#3431d6" opacity="0.4" r="3" />
        <circle cx="1428" cy="570" fill="#3edcf0" opacity="0.44" r="2.5" />
        <circle cx="1588" cy="680" fill="#0b8cff" opacity="0.42" r="4.5" />
        <circle cx="1758" cy="536" fill="#3edcf0" opacity="0.36" r="3" />
        <circle cx="1918" cy="738" fill="#3431d6" opacity="0.38" r="5.5" />
        <ellipse cx="1218" cy="626" fill="#0b8cff" opacity="0.34" rx="18" ry="3" transform="rotate(-18 1218 626)" />
        <ellipse cx="1488" cy="654" fill="#3edcf0" opacity="0.38" rx="22" ry="3.5" transform="rotate(-22 1488 654)" />
        <ellipse cx="1696" cy="572" fill="#0b8cff" opacity="0.32" rx="15" ry="2.5" transform="rotate(-24 1696 572)" />
        <ellipse cx="1940" cy="646" fill="#3edcf0" opacity="0.3" rx="20" ry="3" transform="rotate(-20 1940 646)" />
      </g>

      <g
        id="proof-stroke-04"
        className={`paint-stroke paint-stroke--dry-brush ${styles.stroke} ${styles.dryViolet}`}
        data-index="4"
        data-family="dry-brush"
        data-direction="left-to-right"
        data-depth="background"
        data-entry="fragmented-mask"
        mask="url(#proof-mask-04)"
      >
        <path d="M-120 292 C270 258 570 280 930 330 C1180 365 1390 360 1660 318" fill="none" opacity="0.72" stroke="#7134d5" strokeLinecap="butt" strokeWidth="48" />
        <path d="M-90 337 C250 300 520 315 820 356" fill="none" opacity="0.78" stroke="#944fe0" strokeLinecap="butt" strokeWidth="22" />
        <path d="M420 382 C760 358 1030 410 1360 375" fill="none" opacity="0.62" stroke="#5b26a8" strokeLinecap="butt" strokeWidth="16" />
        <path d="M1020 344 C1230 336 1450 304 1740 248" fill="none" opacity="0.64" stroke="#ad7be9" strokeLinecap="butt" strokeWidth="10" />
        <path d="M-60 374 C170 348 340 356 540 390" fill="none" opacity="0.64" stroke="#c09fe9" strokeLinecap="butt" strokeWidth="6" />
        <path d="M690 408 C920 405 1120 430 1300 406" fill="none" opacity="0.58" stroke="#7134d5" strokeLinecap="butt" strokeWidth="5" />
        <path d="M1490 288 C1630 266 1770 230 1960 180" fill="none" opacity="0.58" stroke="#7134d5" strokeLinecap="butt" strokeWidth="7" />
        <path d="M140 314 C310 292 470 300 620 324M820 348 C970 364 1110 382 1240 374M1390 340 C1510 320 1620 296 1760 256" fill="none" opacity="0.56" stroke="#d3b8ef" strokeLinecap="butt" strokeWidth="3" />
      </g>

      <g
        id="proof-stroke-01"
        className={`paint-stroke paint-stroke--broad-brush ${styles.stroke} ${styles.broadMagenta}`}
        data-index="1"
        data-family="broad-brush"
        data-direction="left-to-right"
        data-depth="background"
        data-entry="mask"
        mask="url(#proof-mask-01)"
      >
        <path d="M-160 682 C180 650 470 666 770 704 C1100 746 1390 724 1710 674 L2010 622 L1960 754 C1650 798 1360 832 1050 802 C700 768 420 730 100 760 L-120 786Z" fill="url(#proof-magenta)" opacity="0.66" />
        <path d="M-120 700 C90 688 274 692 446 706 M494 712 C690 726 862 746 1042 754 M1100 768 C1372 790 1618 750 1804 710 M1850 696 C1904 684 1956 672 2010 662" fill="none" opacity="0.82" stroke="#ee086f" strokeLinecap="butt" strokeWidth="46" />
        <path d="M-40 748 C188 732 382 736 560 750 M606 754 C756 764 892 780 1020 792" fill="none" opacity="0.58" stroke="#ff78b4" strokeLinecap="butt" strokeWidth="14" />
        <path d="M1040 792 C1188 806 1318 806 1438 794 M1486 788 C1622 772 1748 742 1880 716" fill="none" opacity="0.52" stroke="#a80932" strokeLinecap="butt" strokeWidth="16" />
        <path d="M190 786 C346 780 484 788 610 800 M648 804 C762 812 860 820 940 824" fill="none" opacity="0.44" stroke="#ffc0d8" strokeLinecap="butt" strokeWidth="6" />
        <path d="M1420 802 C1530 790 1626 772 1714 750 M1750 742 C1844 720 1936 696 2040 682" fill="none" opacity="0.48" stroke="#ff4aa2" strokeLinecap="butt" strokeWidth="7" />
        <path d="M-80 642 C70 634 194 638 302 648 M342 652 C412 658 478 664 540 670 M1710 642 C1792 626 1860 610 1922 594 M1960 582 C1992 572 2026 560 2060 550" fill="none" opacity="0.5" stroke="#ee086f" strokeLinecap="butt" strokeWidth="5" />
      </g>

      <g
        id="proof-stroke-02"
        className={`paint-stroke paint-stroke--broad-brush ${styles.stroke} ${styles.broadBlue}`}
        data-index="2"
        data-family="broad-brush"
        data-direction="right-to-left"
        data-depth="midground"
        data-entry="mask"
        mask="url(#proof-mask-02)"
      >
        <path d="M2070 172 C1680 218 1380 268 1080 324 C760 386 430 444 70 464 L-120 446 L-80 350 C300 358 620 310 940 250 C1280 184 1620 126 2020 92Z" fill="url(#proof-blue)" opacity="0.62" />
        <path d="M2040 134 C1834 162 1652 190 1480 222 M1428 232 C1282 260 1142 286 1010 310 M950 322 C688 376 456 406 246 414 M194 416 C100 416 6 408 -90 398" fill="none" opacity="0.8" stroke="#3431d6" strokeLinecap="butt" strokeWidth="44" />
        <path d="M1940 202 C1742 224 1560 252 1394 282 M1340 292 C1204 318 1070 344 950 372" fill="none" opacity="0.68" stroke="#0b8cff" strokeLinecap="butt" strokeWidth="16" />
        <path d="M860 394 C694 422 544 442 406 454 M356 458 C196 468 44 460 -110 444" fill="none" opacity="0.46" stroke="#3edcf0" strokeLinecap="butt" strokeWidth="10" />
        <path d="M1770 238 C1602 262 1454 288 1318 316 M1268 326 C1190 342 1118 358 1050 374" fill="none" opacity="0.46" stroke="#9c7beb" strokeLinecap="butt" strokeWidth="7" />
        <path d="M620 448 C486 466 366 476 252 478 M210 478 C114 478 20 470 -70 462" fill="none" opacity="0.44" stroke="#6fddeb" strokeLinecap="butt" strokeWidth="5" />
        <path d="M1900 92 C1816 100 1736 110 1664 120 M1628 126 C1588 132 1548 138 1510 142 M340 330 C246 340 162 346 84 348 M44 348 C0 346 -44 344 -90 340" fill="none" opacity="0.46" stroke="#0b8cff" strokeLinecap="butt" strokeWidth="6" />
      </g>

      <g
        id="proof-stroke-03"
        className={`paint-stroke paint-stroke--broad-brush ${styles.stroke} ${styles.broadRed}`}
        data-index="3"
        data-family="broad-brush"
        data-direction="left-to-right"
        data-depth="midground"
        data-entry="mask"
        mask="url(#proof-mask-03)"
      >
        <path d="M-150 864 C240 850 570 832 900 846 C1250 860 1540 842 1850 774 L2050 722 L2020 862 C1700 920 1400 944 1080 916 C730 886 410 902 70 940 L-120 946Z" fill="url(#proof-red)" opacity="0.58" />
        <path d="M-100 882 C120 870 318 864 498 866 M550 868 C728 870 884 876 1040 886 M1100 890 C1328 902 1522 880 1696 844 M1750 832 C1846 810 1940 790 2040 772" fill="none" opacity="0.82" stroke="#db2435" strokeLinecap="butt" strokeWidth="42" />
        <path d="M30 930 C226 914 402 908 562 910 M610 912 C748 914 872 920 980 928" fill="none" opacity="0.54" stroke="#ff5968" strokeLinecap="butt" strokeWidth="13" />
        <path d="M1120 924 C1268 930 1400 920 1522 900 M1570 892 C1696 870 1818 844 1940 820" fill="none" opacity="0.5" stroke="#a80932" strokeLinecap="butt" strokeWidth="15" />
        <path d="M270 958 C408 946 534 942 650 946 M694 948 C784 950 864 954 930 958" fill="none" opacity="0.4" stroke="#ff9aa5" strokeLinecap="butt" strokeWidth="6" />
        <path d="M1480 910 C1580 892 1672 874 1760 854 M1804 844 C1896 822 1982 794 2070 770" fill="none" opacity="0.44" stroke="#ee086f" strokeLinecap="butt" strokeWidth="7" />
      </g>

      <g
        id="proof-stroke-05"
        className={`paint-stroke paint-stroke--dry-brush ${styles.stroke} ${styles.dryWhite}`}
        data-index="5"
        data-family="dry-brush"
        data-direction="right-to-left"
        data-depth="midground"
        data-entry="fragmented-mask"
        mask="url(#proof-mask-05)"
      >
        <path d="M2050 420 C1840 430 1642 452 1468 480 L1320 504 L1170 540 L1222 506 L1340 470 L1508 442 L1690 420 L1846 408 L1970 402Z" fill="#f2eee6" opacity="0.78" />
        <path d="M1938 474 C1748 490 1584 514 1438 542 L1284 570 L1112 604 L1152 572 L1298 532 L1452 506 L1620 482 L1790 466Z" fill="#d8d1c5" opacity="0.7" />
        <path d="M1750 414 L1662 434 L1568 438 L1476 458 L1384 462 L1290 488 L1200 506 L1238 478 L1324 446 L1418 440 L1510 416 L1602 414 L1698 398Z" fill="#fbf8f1" opacity="0.74" />
        <path d="M1410 584 L1324 606 L1234 612 L1142 638 L1048 642 L950 672 L842 694 L886 662 L978 632 L1070 622 L1160 596 L1252 588 L1342 564Z" fill="#f2eee6" opacity="0.62" />
        <path d="M1110 618 L1042 642 L970 648 L900 672 L830 680 L760 706 L684 716 L720 690 L792 664 L860 656 L930 632 L1002 626 L1066 606Z" fill="#c8c0b4" opacity="0.56" />
        <path d="M1994 382 L1904 398 L1812 398 L1724 420 L1634 430 L1668 410 L1758 390 L1848 386 L1936 372Z M1010 692 L930 712 L848 716 L768 742 L652 774 L700 738 L790 708 L876 696 L956 680Z" fill="#fbf8f1" opacity="0.6" />
        <path d="M1870 452 L1740 470 L1610 484 L1480 512 L1320 538 M1270 606 L1150 630 L1030 650 L910 680 L778 706" fill="none" opacity="0.56" stroke="#fbf8f1" strokeLinecap="butt" strokeWidth="3" />
        <path d="M2036 322 L1948 350 L1854 364 L1762 398 L1668 408 L1570 446 L1476 460 L1512 438 L1604 402 L1698 390 L1790 360 L1882 344 L1974 312Z" fill="#fbf8f1" opacity="0.58" />
        <path d="M1828 520 L1738 544 L1644 552 L1552 580 L1458 590 L1364 622 L1274 632 L1314 606 L1402 576 L1496 566 L1588 538 L1680 528 L1772 500Z" fill="#d8d1c5" opacity="0.52" />
        <path d="M1178 674 L1120 690 L1058 694 L998 716 L938 722 L874 746 L810 752 L844 730 L906 706 L968 700 L1028 680 L1090 676 L1148 660Z" fill="#f2eee6" opacity="0.42" />
        <path d="M2018 354 L1944 374 M1900 384 L1816 406 M1770 416 L1686 440 M1640 452 L1562 472 M1518 484 L1442 502 M1760 574 L1668 596 M1620 606 L1532 630 M1482 642 L1390 668" fill="none" opacity="0.48" stroke="#fbf8f1" strokeLinecap="butt" strokeWidth="4" />
      </g>

      <g
        id="proof-stroke-06"
        className={`paint-stroke paint-stroke--curved-sweep ${styles.stroke}`}
        data-index="6"
        data-family="curved-sweep"
        data-direction="left-to-right"
        data-depth="foreground"
        data-entry="mask"
        mask="url(#proof-mask-06)"
      >
        <path d="M-150 995 C330 885 690 815 1040 830 C1420 845 1690 760 2070 650" fill="none" opacity="0.8" stroke="#f2eee6" strokeLinecap="butt" strokeWidth="52" />
        <path d="M-80 954 C350 860 700 798 1030 810 C1370 824 1660 742 2000 650" fill="none" opacity="0.64" stroke="#fbf8f1" strokeLinecap="round" strokeWidth="15" />
        <path d="M40 1010 C420 912 730 854 1020 866" fill="none" opacity="0.5" stroke="#c8c0b4" strokeLinecap="round" strokeWidth="10" />
        <path d="M1140 858 C1440 852 1700 776 1980 696" fill="none" opacity="0.46" stroke="#f2eee6" strokeLinecap="round" strokeWidth="8" />
        <path d="M260 932 C520 874 730 842 900 844M1550 790 C1710 752 1840 714 2020 652" fill="none" opacity="0.48" stroke="#fbf8f1" strokeLinecap="round" strokeWidth="5" />
      </g>

      <g
        id="proof-stroke-07"
        className={`paint-stroke paint-stroke--curved-sweep ${styles.stroke}`}
        data-index="7"
        data-family="curved-sweep"
        data-direction="top-to-bottom"
        data-depth="midground"
        data-entry="mask"
        mask="url(#proof-mask-07)"
      >
        <path d="M560 -110 C420 170 470 360 610 520 C770 705 645 875 430 1170" fill="none" opacity="0.72" stroke="#0b8cff" strokeLinecap="butt" strokeWidth="46" />
        <path d="M606 -80 C484 176 520 342 650 494 C804 674 704 846 510 1120" fill="none" opacity="0.64" stroke="#3edcf0" strokeLinecap="round" strokeWidth="14" />
        <path d="M518 -60 C408 190 442 380 566 538" fill="none" opacity="0.5" stroke="#7134d5" strokeLinecap="round" strokeWidth="10" />
        <path d="M642 574 C742 720 664 868 500 1080" fill="none" opacity="0.46" stroke="#8be9f3" strokeLinecap="round" strokeWidth="7" />
        <path d="M488 100 C448 238 476 350 546 442M630 900 C582 980 532 1050 468 1130" fill="none" opacity="0.46" stroke="#0b8cff" strokeLinecap="round" strokeWidth="5" />
      </g>

      <g
        id="proof-stroke-08"
        className={`paint-stroke paint-stroke--thin-flick ${styles.stroke} ${styles.flickCyan}`}
        data-index="8"
        data-family="thin-flick"
        data-direction="left-to-right"
        data-depth="foreground"
        data-entry="stroke-draw"
      >
        <g data-hero-brush-pull>
          <rect fill="url(#proof-magenta)" height="700" mask="url(#proof-hero-brush-texture)" opacity="0.84" width="1400" x="700" y="130" />
          <path
            d="M782 742 C942 688 1088 638 1224 586 M1270 568 C1410 512 1538 456 1656 400 M1704 378 C1818 324 1922 274 2028 222"
            fill="none"
            opacity="0.62"
            stroke="#ff78b4"
            strokeLinecap="butt"
            strokeWidth="12"
          />
          <path
            d="M820 770 C924 738 1020 704 1110 670 M1154 654 C1252 616 1342 578 1426 542 M1470 522 C1570 478 1662 434 1748 394 M1790 374 C1870 336 1944 300 2022 260"
            fill="none"
            opacity="0.48"
            stroke="#a80932"
            strokeLinecap="butt"
            strokeWidth="7"
          />
          <path
            d="M760 786 C844 760 918 736 986 712 M1034 696 L1112 668 M1160 652 L1244 620 M1294 600 L1382 566 M1432 546 L1514 510 M1562 490 L1648 450 M1700 426 L1786 386 M1832 364 L1948 304"
            fill="none"
            opacity="0.54"
            stroke="#ffc0d8"
            strokeLinecap="butt"
            strokeWidth="4"
          />
          <path
            d="M850 696 L888 680 M922 666 L960 652 M1000 638 L1044 622 M1088 606 L1136 588 M1182 570 L1234 550 M1284 530 L1336 510 M1390 488 L1440 468 M1492 446 L1542 424 M1594 400 L1648 376 M1700 352 L1748 330 M1804 304 L1850 284 M1902 258 L1948 236"
            fill="none"
            opacity="0.66"
            stroke="#f39ad0"
            strokeLinecap="butt"
            strokeWidth="5"
          />
          <path
            d="M796 716 L828 702 M860 690 L892 676 M926 664 L958 652 M992 638 L1024 626 M1848 338 L1880 322 M1912 306 L1942 292 M1970 276 L1998 262"
            fill="none"
            opacity="0.56"
            stroke="#6f164a"
            strokeLinecap="butt"
            strokeWidth="8"
          />
          <path
            d="M842 780 L874 770 M908 758 L940 746 M978 732 L1012 720 M1050 706 L1086 692 M1122 680 L1156 668 M1668 434 L1702 416 M1738 400 L1772 382 M1810 364 L1844 348 M1880 330 L1914 312"
            fill="none"
            opacity="0.48"
            stroke="#ff91c0"
            strokeLinecap="butt"
            strokeWidth="2.5"
          />
        </g>
        <path data-line-reveal d="M-80 298 C72 278 212 270 340 272 M390 276 C538 282 660 294 790 302 M846 310 C1080 336 1294 316 1466 282 M1518 272 C1700 232 1866 194 2040 176" fill="none" pathLength="1" stroke="#3edcf0" strokeDasharray="1" strokeLinecap="butt" strokeWidth="7" />
        <path data-line-reveal d="M30 326 C176 306 310 298 430 300 M478 302 C580 308 670 318 760 326 M820 334 C1010 354 1168 348 1306 330 M1350 324 C1396 318 1440 310 1480 304" fill="none" opacity="0.58" pathLength="1" stroke="#a7f3f7" strokeDasharray="1" strokeLinecap="butt" strokeWidth="3" />
        <path data-line-reveal d="M1420 296 C1518 280 1608 262 1690 244 M1734 234 C1834 210 1924 196 2010 192" fill="none" opacity="0.42" pathLength="1" stroke="#0b8cff" strokeDasharray="1" strokeLinecap="butt" strokeWidth="2" />
        <path data-line-reveal d="M864 390 C1030 398 1178 388 1312 362 M1360 352 C1498 324 1622 292 1736 258 M1782 244 C1872 216 1956 190 2042 170" fill="none" opacity="0.52" pathLength="1" stroke="#3edcf0" strokeDasharray="1" strokeLinecap="butt" strokeWidth="3.5" />
        <path data-line-reveal d="M1018 422 C1142 416 1252 398 1352 372 M1398 360 C1496 332 1582 304 1662 278 M1704 264 L1794 232 M1836 218 L1930 182" fill="none" opacity="0.42" pathLength="1" stroke="#a7f3f7" strokeDasharray="1" strokeLinecap="butt" strokeWidth="2" />
        <path data-line-reveal d="M1188 454 C1286 436 1376 410 1456 382 M1498 368 L1578 338 M1620 322 L1706 288 M1754 270 L1826 240 M1870 222 L1946 190" fill="none" opacity="0.34" pathLength="1" stroke="#0b8cff" strokeDasharray="1" strokeLinecap="butt" strokeWidth="1.5" />
      </g>

      <g
        id="proof-stroke-09"
        className={`paint-stroke paint-stroke--thin-flick ${styles.stroke} ${styles.flickLime}`}
        data-index="9"
        data-family="thin-flick"
        data-direction="bottom-to-top"
        data-depth="foreground"
        data-entry="stroke-draw"
      >
        <path data-line-reveal d="M1510 1160 C1478 1038 1470 930 1486 838 M1496 790 C1516 702 1550 626 1600 560 M1630 510 C1676 430 1708 340 1718 246 M1722 190 C1726 100 1724 12 1720 -80" fill="none" pathLength="1" stroke="#9edc34" strokeDasharray="1" strokeLinecap="butt" strokeWidth="8" />
        <path data-line-reveal d="M1560 1110 C1536 1000 1532 908 1548 826 M1558 782 C1576 714 1602 650 1640 594 M1668 548 C1704 484 1728 416 1742 344 M1748 304 C1754 242 1754 180 1750 118" fill="none" opacity="0.5" pathLength="1" stroke="#d6f58e" strokeDasharray="1" strokeLinecap="butt" strokeWidth="3" />
        <path data-line-reveal d="M1472 1080 C1454 986 1454 904 1466 836 M1474 796 C1486 748 1506 704 1534 666" fill="none" opacity="0.36" pathLength="1" stroke="#76a921" strokeDasharray="1" strokeLinecap="butt" strokeWidth="2" />
      </g>

      <g
        id="proof-stroke-10"
        className={`paint-stroke paint-stroke--scratch ${styles.stroke} ${styles.scratchWhite}`}
        data-index="10"
        data-family="scratch"
        data-direction="left-to-right"
        data-depth="foreground"
        data-entry="stroke-draw"
      >
        <path data-line-reveal d="M-40 1004 C420 944 780 930 1190 954 C1450 970 1690 936 1990 870" fill="none" pathLength="1" stroke="#f2eee6" strokeDasharray="1" strokeLinecap="round" strokeWidth="3.5" />
        <path data-line-reveal d="M160 1040 C520 980 850 978 1210 1000" fill="none" opacity="0.62" pathLength="1" stroke="#f2eee6" strokeDasharray="1" strokeLinecap="round" strokeWidth="2" />
        <path data-line-reveal d="M1210 1012 C1480 1006 1700 960 1900 918" fill="none" opacity="0.46" pathLength="1" stroke="#f2eee6" strokeDasharray="1" strokeLinecap="round" strokeWidth="1.5" />
      </g>

      <g
        id="proof-stroke-11"
        className={`paint-stroke paint-stroke--scratch ${styles.stroke} ${styles.scratchMagenta}`}
        data-index="11"
        data-family="scratch"
        data-direction="right-to-left"
        data-depth="foreground"
        data-entry="stroke-draw"
      >
        <path data-line-reveal d="M1980 356 C1818 370 1672 388 1540 410 M1492 418 C1324 448 1180 480 1050 510 M994 524 C752 580 544 600 346 590 M294 586 C182 576 74 560 -40 548" fill="none" pathLength="1" stroke="#ff4aa2" strokeDasharray="1" strokeLinecap="butt" strokeWidth="4" />
        <path data-line-reveal d="M1850 390 C1690 410 1546 432 1412 458 M1368 466 C1238 492 1118 518 1010 544" fill="none" opacity="0.52" pathLength="1" stroke="#ee086f" strokeDasharray="1" strokeLinecap="butt" strokeWidth="2" />
        <path data-line-reveal d="M820 590 C682 610 556 620 442 618 M402 616 C290 614 190 602 90 590" fill="none" opacity="0.38" pathLength="1" stroke="#ff91c0" strokeDasharray="1" strokeLinecap="butt" strokeWidth="1.5" />
        <path data-line-reveal d="M2044 300 C1902 328 1774 358 1660 390 M1614 402 C1498 436 1394 470 1300 504 M1258 518 L1170 548 M1128 562 L1042 590" fill="none" opacity="0.56" pathLength="1" stroke="#ff78b4" strokeDasharray="1" strokeLinecap="butt" strokeWidth="3" />
        <path data-line-reveal d="M1938 434 C1816 454 1708 478 1610 504 M1568 516 L1474 544 M1430 556 L1344 584 M1302 596 L1222 624" fill="none" opacity="0.44" pathLength="1" stroke="#ee086f" strokeDasharray="1" strokeLinecap="butt" strokeWidth="2.5" />
        <path data-line-reveal d="M1782 548 C1692 568 1608 592 1532 618 M1494 630 L1418 658 M1380 670 L1312 696 M1272 708 L1204 736" fill="none" opacity="0.36" pathLength="1" stroke="#ff91c0" strokeDasharray="1" strokeLinecap="butt" strokeWidth="1.5" />
      </g>

      <g
        id="proof-stroke-14"
        className={`paint-stroke paint-stroke--spray-burst ${styles.stroke} ${styles.burstRed}`}
        data-index="14"
        data-family="spray-burst"
        data-direction="left-edge-in"
        data-depth="foreground"
        data-entry="particle-clusters"
      >
        <g className={styles.clusterA}>
          <path d="M88 470 C92 456 104 448 116 454 C128 448 140 458 138 470 C150 480 142 494 128 492 C122 508 104 510 98 496 C84 494 78 480 88 470Z" fill="#db2435" />
          <circle cx="156" cy="438" fill="#ee086f" r="10" />
          <ellipse cx="204" cy="502" fill="#ff4aa2" rx="18" ry="6" transform="rotate(18 204 502)" />
          <path d="M118 510 C116 548 121 576 114 612" fill="none" stroke="#db2435" strokeLinecap="round" strokeWidth="8" />
        </g>
        <g className={styles.clusterB}>
          <circle cx="46" cy="392" fill="#ff4aa2" r="6" />
          <circle cx="240" cy="410" fill="#a80932" r="8" />
          <circle cx="282" cy="548" fill="#ee086f" r="5" />
          <path d="M38 550 C42 540 54 540 58 548 C68 550 68 564 60 568 C54 578 40 572 42 562 C34 560 32 554 38 550Z" fill="#db2435" />
          <path d="M218 532 C214 558 220 580 216 598" fill="none" stroke="#ee086f" strokeLinecap="round" strokeWidth="5" />
        </g>
        <g className={styles.clusterC}>
          <circle cx="18" cy="470" fill="#ee086f" r="3" />
          <circle cx="314" cy="454" fill="#ff4aa2" r="4" />
          <circle cx="342" cy="586" fill="#a80932" r="6" />
          <circle cx="194" cy="640" fill="#ee086f" r="3" />
          <ellipse cx="82" cy="646" fill="#ff4aa2" rx="9" ry="3" transform="rotate(-18 82 646)" />
        </g>
      </g>

      <g
        id="proof-stroke-15"
        className={`paint-stroke paint-stroke--spray-burst ${styles.stroke} ${styles.burstCyan}`}
        data-index="15"
        data-family="spray-burst"
        data-direction="right-edge-in"
        data-depth="foreground"
        data-entry="particle-clusters"
      >
        <g className={styles.clusterA}>
          <path d="M1780 610 C1788 596 1802 594 1810 604 C1824 600 1832 614 1826 626 C1832 640 1816 650 1806 642 C1796 654 1780 646 1782 634 C1770 628 1772 616 1780 610Z" fill="#3edcf0" />
          <circle cx="1860" cy="578" fill="#0b8cff" r="11" />
          <ellipse cx="1728" cy="662" fill="#7cecf3" rx="17" ry="5" transform="rotate(-22 1728 662)" />
          <path d="M1834 636 C1830 670 1836 702 1830 738" fill="none" stroke="#3edcf0" strokeLinecap="round" strokeWidth="7" />
        </g>
        <g className={styles.clusterB}>
          <circle cx="1920" cy="530" fill="#3edcf0" r="7" />
          <circle cx="1680" cy="572" fill="#0b8cff" r="8" />
          <circle cx="1640" cy="716" fill="#3edcf0" r="5" />
          <path d="M1900 700 C1906 690 1918 690 1922 698 C1932 702 1930 714 1922 718 C1916 728 1902 722 1904 712 C1896 710 1894 704 1900 700Z" fill="#0b8cff" />
          <path d="M1740 690 C1738 718 1744 742 1740 764" fill="none" stroke="#0b8cff" strokeLinecap="round" strokeWidth="5" />
        </g>
        <g className={styles.clusterC}>
          <circle cx="1960" cy="620" fill="#0b8cff" r="3" />
          <circle cx="1596" cy="636" fill="#3edcf0" r="4" />
          <circle cx="1550" cy="760" fill="#0b8cff" r="6" />
          <circle cx="1750" cy="806" fill="#3edcf0" r="3" />
          <ellipse cx="1880" cy="780" fill="#7cecf3" rx="10" ry="3" transform="rotate(16 1880 780)" />
          <circle cx="1512" cy="686" fill="#3edcf0" opacity="0.76" r="2.5" />
          <circle cx="1608" cy="818" fill="#0b8cff" opacity="0.72" r="3" />
          <circle cx="1814" cy="746" fill="#3edcf0" opacity="0.72" r="4" />
          <circle cx="1992" cy="690" fill="#0b8cff" opacity="0.68" r="5" />
          <ellipse cx="1660" cy="654" fill="#7cecf3" opacity="0.7" rx="14" ry="2.5" transform="rotate(-24 1660 654)" />
          <ellipse cx="1932" cy="738" fill="#3edcf0" opacity="0.66" rx="16" ry="2.5" transform="rotate(-18 1932 738)" />
        </g>
      </g>

      <g
        id="proof-stroke-16"
        className={`paint-stroke paint-stroke--splatter ${styles.stroke} ${styles.splatterWhite}`}
        data-index="16"
        data-family="splatter"
        data-direction="top-edge-in"
        data-depth="foreground"
        data-entry="particle-clusters"
      >
        <g className={styles.clusterA}>
          <path d="M1000 100 C1004 84 1018 78 1028 88 C1042 82 1054 94 1050 108 C1062 118 1052 134 1038 130 C1030 144 1012 138 1010 126 C996 124 990 110 1000 100Z" fill="#f2eee6" />
          <circle cx="944" cy="148" fill="#f2eee6" r="10" />
          <circle cx="1080" cy="156" fill="#f2eee6" r="7" />
          <path d="M1030 132 C1028 162 1033 188 1028 214" fill="none" stroke="#f2eee6" strokeLinecap="round" strokeWidth="7" />
        </g>
        <g className={styles.clusterB}>
          <circle cx="900" cy="92" fill="#f2eee6" r="4" />
          <circle cx="1128" cy="80" fill="#f2eee6" r="8" />
          <circle cx="1160" cy="188" fill="#f2eee6" r="4" />
          <path d="M858 190 C864 180 876 184 878 192 C886 198 880 208 872 206 C864 214 854 206 858 198 C850 196 852 190 858 190Z" fill="#f2eee6" />
        </g>
        <g className={styles.clusterC}>
          <circle cx="812" cy="58" fill="#f2eee6" r="3" />
          <circle cx="1204" cy="40" fill="#f2eee6" r="4" />
          <circle cx="1240" cy="224" fill="#f2eee6" r="5" />
          <ellipse cx="780" cy="228" fill="#f2eee6" rx="9" ry="3" transform="rotate(-18 780 228)" />
        </g>
      </g>

      <g
        id="proof-stroke-17"
        className={`paint-stroke paint-stroke--splatter ${styles.stroke} ${styles.splatterViolet}`}
        data-index="17"
        data-family="splatter"
        data-direction="bottom-edge-in"
        data-depth="foreground"
        data-entry="particle-clusters"
      >
        <g className={styles.clusterA}>
          <path d="M1040 942 C1048 928 1062 928 1070 938 C1084 936 1090 952 1082 962 C1088 976 1072 986 1062 978 C1050 988 1036 978 1038 966 C1026 960 1030 948 1040 942Z" fill="#7134d5" />
          <circle cx="980" cy="920" fill="#ee086f" r="11" />
          <circle cx="1120" cy="932" fill="#0b8cff" r="8" />
          <path d="M1068 976 C1070 1010 1064 1034 1068 1068" fill="none" stroke="#7134d5" strokeLinecap="round" strokeWidth="8" />
        </g>
        <g className={styles.clusterB}>
          <circle cx="920" cy="982" fill="#7134d5" r="6" />
          <circle cx="1170" cy="878" fill="#ee086f" r="9" />
          <circle cx="1210" cy="1010" fill="#3431d6" r="5" />
          <path d="M884 880 C890 870 902 870 906 878 C916 882 914 894 906 898 C900 906 888 902 888 894 C878 892 878 884 884 880Z" fill="#0b8cff" />
        </g>
        <g className={styles.clusterC}>
          <circle cx="842" cy="1020" fill="#ee086f" r="4" />
          <circle cx="1230" cy="830" fill="#7134d5" r="5" />
          <circle cx="1290" cy="1040" fill="#0b8cff" r="7" />
          <ellipse cx="820" cy="870" fill="#7134d5" rx="10" ry="3" transform="rotate(20 820 870)" />
        </g>
      </g>
    </svg>
  );
}
